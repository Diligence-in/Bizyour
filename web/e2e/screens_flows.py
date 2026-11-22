"""Rebuilt screens: every arrow item from the old menu now opens inside the new app.

    python3 -I web/e2e/screens_flows.py http://localhost:4100 /path/to/shots
"""
import re, sys
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4100"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else "/tmp"
results = []
P = {}


def step(name, fn):
    try:
        fn(); results.append((name, "PASS", ""))
    except Exception as e:  # noqa: BLE001
        P["p"].screenshot(path=f"{SHOTS}/fail-screens-{re.sub(r'[^a-z]+', '_', name.lower())}.png")
        results.append((name, "FAIL", str(e).splitlines()[0][:300]))


def export_formats():
    p = P["p"]
    for path, name in (("/bills", "sales"), ("/expenses", "expenses"), ("/customers", "customers")):
        p.goto(BASE + path)
        for label, ext, magic in (("Excel (.xlsx)", "xlsx", b"PK"), ("PDF", "pdf", b"%PDF"), ("CSV", "csv", b"\xef\xbb\xbf")):
            p.get_by_role("button", name=re.compile(r"^Export")).click()
            with p.expect_download(timeout=15000) as d:
                p.get_by_role("menuitem", name=label).click()
            dl = d.value
            assert dl.suggested_filename.endswith("." + ext), dl.suggested_filename
            assert open(dl.path(), "rb").read(8).startswith(magic), (name, ext)


def login():
    p = P["p"]
    p.goto(BASE + "/login")
    p.get_by_label("Email or mobile").fill("demo@businessos.app")
    p.get_by_label("Password").fill("demo1234")
    p.get_by_role("button", name="Log in").click()
    p.get_by_test_id("door-workspace").click()
    expect(p.get_by_text("Sold today")).to_be_visible(timeout=8000)


def menu_stays_in_app():
    p = P["p"]
    assert p.locator(".nav-link[href^='/classic']").count() == 0, "a menu item still opens the old app"
    for label, path in [("Estimates", "/estimates"), ("Expenses", "/expenses"), ("Reports & GST", "/reports"), ("History", "/history"), ("Settings", "/settings"), ("Help", "/help")]:
        p.locator(".sidebar").get_by_role("link", name=label).first.click()
        p.wait_for_url(f"**{path}*")
        assert "/classic" not in p.url


def expense_cycle():
    p = P["p"]
    p.goto(BASE + "/expenses")
    p.get_by_role("button", name="Add expense").first.click()
    p.get_by_label("What was it for?").fill("Shop rent test")
    p.get_by_label("Amount ₹").fill("4500")
    p.get_by_role("button", name="Save expense").click()
    expect(p.get_by_text("Shop rent test").first).to_be_visible(timeout=6000)
    p.screenshot(path=f"{SHOTS}/new-expenses.png")
    p.get_by_role("button", name="Edit").first.click()
    p.get_by_label("Amount ₹").fill("5000")
    p.get_by_role("button", name="Save expense").click()
    expect(p.get_by_text("₹5,000").first).to_be_visible(timeout=6000)
    p.get_by_role("button", name="Delete").first.click()
    p.locator(".modal").get_by_role("button", name="Delete").click()
    expect(p.get_by_text("Shop rent test")).to_have_count(0, timeout=6000)


def reports_tabs():
    p = P["p"]
    p.goto(BASE + "/reports")
    expect(p.get_by_text("Net profit").first).to_be_visible(timeout=8000)
    p.screenshot(path=f"{SHOTS}/new-reports.png", full_page=True)
    for tab, text in [("Month by month", "Last months"), ("GST", "By GST rate"), ("GSTR-1", "Summary")]:
        p.get_by_role("tab", name=tab, exact=True).click()
        expect(p.get_by_text(text).first.or_(p.get_by_text("GST is off")).first).to_be_visible(timeout=8000)


def estimate_cycle():
    p = P["p"]
    p.goto(BASE + "/estimates")
    p.get_by_role("button", name="New estimate").first.click()
    d = p.locator(".drawer")
    d.get_by_label("Product").first.select_option(index=1)
    d.get_by_role("button", name="Save estimate").click()
    expect(p.locator(".drawer").get_by_text(re.compile("Estimate #"))).to_be_visible(timeout=8000)
    p.screenshot(path=f"{SHOTS}/new-estimate.png")
    p.get_by_role("button", name="Make bill").click()
    p.wait_for_url("**/bills/*", timeout=8000)


def history_lists():
    p = P["p"]
    p.goto(BASE + "/history")
    expect(p.locator(".hist-row").first).to_be_visible(timeout=8000)


def settings_tabs():
    p = P["p"]
    p.goto(BASE + "/settings")
    expect(p.get_by_label("Shop name")).to_have_value(re.compile(".+"))
    p.get_by_label("City").fill("Gurugram")
    p.get_by_role("button", name="Save settings").click()
    expect(p.get_by_text("Settings saved")).to_be_visible(timeout=6000)
    p.screenshot(path=f"{SHOTS}/new-settings.png", full_page=True)
    p.get_by_role("tab", name="Staff").click()
    expect(p.get_by_text("People who can log in")).to_be_visible()
    p.get_by_role("tab", name="Plan").click()
    expect(p.get_by_text("Workspace plan").first).to_be_visible()
    expect(p.get_by_text("Business Mart is free, always").first).to_be_visible()
    p.get_by_role("tab", name="Data").click()
    p.get_by_role("button", name="Back up now").click()
    expect(p.get_by_text("Backup saved")).to_be_visible(timeout=6000)


def help_page():
    p = P["p"]
    p.goto(BASE + "/help")
    p.get_by_text("What is an estimate?").click()
    expect(p.get_by_text("A quotation.")).to_be_visible()


def staff_blocked():
    p = P["p"]
    p.evaluate("localStorage.clear(); sessionStorage.clear()")
    p.goto(BASE + "/login")
    p.get_by_label("Email or mobile").fill("counter@businessos.app")
    p.get_by_label("Password").fill("staff1234")
    p.get_by_role("button", name="Log in").click()
    expect(p.get_by_text("Sold today").or_(p.get_by_test_id("door-workspace")).first).to_be_visible(timeout=8000)
    if p.get_by_test_id("door-workspace").count():
        p.get_by_test_id("door-workspace").click()
    p.goto(BASE + "/reports")
    expect(p.get_by_role("heading", name="Reports & GST")).to_have_count(0)
    p.goto(BASE + "/settings")
    expect(p.get_by_text("Only the shop owner can change these.")).to_be_visible(timeout=6000)


def logo_first():
    p = P["p"]
    p.goto(BASE + "/", wait_until="commit")
    # the logo is in the very first HTML, before any script runs
    html = p.request.get(BASE + "/").text()
    assert "pre-boot" in html and "bizyour-mark-512.png" in html


with sync_playwright() as pw:
    br = pw.chromium.launch()
    P["p"] = br.new_context(viewport={"width": 1280, "height": 800}).new_page()
    step("Logo is in the first HTML", logo_first)
    step("Owner logs in", login)
    step("No menu item opens the old app", menu_stays_in_app)
    step("Expense: add, edit, delete", expense_cycle)
    step("Reports: all four tabs", reports_tabs)
    step("Estimate: create, make bill", estimate_cycle)
    step("History lists entries", history_lists)
    step("Settings: save, staff, plan, backup", settings_tabs)
    step("Help answers open", help_page)
    step("Export offers Excel, PDF and CSV", export_formats)
    step("Staff cannot reach owner screens", staff_blocked)
    br.close()

for n, s, m in results:
    print(f"{s}  {n}  {m}")
sys.exit(1 if any(s == "FAIL" for _, s, _ in results) else 0)
