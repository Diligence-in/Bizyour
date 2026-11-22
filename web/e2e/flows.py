"""End-to-end UI flows for the rebuilt BizYour web app.

Runs a real browser against a real server + seeded demo database and checks
results through the API (not just the screen). Usage:

    python3 -I web/e2e/flows.py http://localhost:4100 /path/to/shots

Exit code is non-zero if any flow fails.
"""
import json, re, sys, time, urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4100"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else "/tmp"
results = []
console_errors = []


def api(token, path, method="GET", body=None):
    req = urllib.request.Request(BASE + path, method=method, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                                 data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def flow(name):
    def deco(fn):
        def run(page, ctx):
            try:
                fn(page, ctx)
                results.append((name, "PASS", ""))
            except Exception as e:  # noqa: BLE001
                page.screenshot(path=f"{SHOTS}/fail-{name.replace(' ', '_')}.png")
                results.append((name, "FAIL", str(e).splitlines()[0][:300]))
        run.__name__ = name
        return run
    return deco


@flow("login through the form")
def login(page, ctx):
    page.goto(BASE + "/login")
    page.get_by_label("Email or mobile").fill("demo@businessos.app")
    page.get_by_label("Password").fill("demo1234")
    page.get_by_role("button", name="Log in").click()
    page.wait_for_url("**/welcome")                     # the Workspace | Business Mart doors
    page.get_by_test_id("door-workspace").click()
    expect(page.get_by_text("Sold today")).to_be_visible(timeout=8000)
    expect(page.get_by_text("₹1,128").first).to_be_visible()
    ctx["token"] = page.evaluate("localStorage.getItem('bos_token')")


@flow("keyboard counter: udhaar bill for a customer")
def pos_keyboard(page, ctx):
    t = ctx["token"]
    before = {c["name"]: c for c in api(t, "/api/customers")["customers"]}["Ramesh Gupta"]["pending"]
    stock_before = {p["name"]: p for p in api(t, "/api/billing-products")["products"]}["Atta 10kg"]["stock_qty"]
    page.keyboard.press("n")
    expect(page.get_by_role("heading", name="New bill")).to_be_visible()
    s = page.get_by_placeholder("Type an item name…")
    s.fill("atta"); page.keyboard.press("Enter")
    s.fill("chee"); page.keyboard.press("Enter")
    s.fill("chee"); page.keyboard.press("Enter")   # second Enter → qty 2
    expect(page.locator(".sheet-line")).to_have_count(2)
    page.locator("body").click(position={"x": 5, "y": 5})
    page.keyboard.press("c")
    page.get_by_placeholder("Customer name or mobile").fill("ramesh")
    page.keyboard.press("Enter")
    page.keyboard.press("F5")  # Udhaar
    expect(page.get_by_text("goes to Ramesh Gupta’s udhaar")).to_be_visible()
    expect(page.locator(".pos-total")).to_contain_text("₹575")  # 485 + 2×45
    page.screenshot(path=f"{SHOTS}/after-desktop-pos-filled.png")
    page.keyboard.press("Control+Enter")
    expect(page.get_by_text("saved")).to_be_visible(timeout=8000)
    page.screenshot(path=f"{SHOTS}/after-desktop-pos-done.png")
    after = {c["name"]: c for c in api(t, "/api/customers")["customers"]}["Ramesh Gupta"]["pending"]
    assert round(after - before, 2) == 575, f"udhaar grew by {after - before}"
    stock_after = {p["name"]: p for p in api(t, "/api/billing-products")["products"]}["Atta 10kg"]["stock_qty"]
    assert stock_after == stock_before - 1, "stock did not drop"
    inv = api(t, "/api/invoices")["invoices"][0]
    assert inv["customer_name"] == "Ramesh Gupta" and inv["paid_amount"] == 0 and inv["due_date"], inv
    ctx["bill_id"] = inv["id"]
    page.keyboard.press("Enter")  # next bill
    expect(page.get_by_placeholder("Type an item name…")).to_be_visible()


@flow("cash bill by tapping, with discount")
def pos_cash(page, ctx):
    t = ctx["token"]
    page.goto(BASE + "/pos")
    page.locator(".chip", has_text="Tata Namak").click()
    page.locator(".chip", has_text="Tata Namak").count()  # chips hide once lines exist
    page.get_by_placeholder("Type an item name…").fill("sarso")
    page.locator(".pos-result").first.click()
    page.get_by_label("Discount").fill("3")
    expect(page.locator(".pos-total")).to_contain_text("₹200")  # 28 + 175 − 3
    page.get_by_role("button", name="UPI").click()
    page.get_by_role("button", name="Save bill").click()
    expect(page.get_by_text("saved")).to_be_visible(timeout=8000)
    inv = api(t, "/api/invoices")["invoices"][0]
    assert inv["total"] == 200 and inv["paid_amount"] == 200 and inv["payment_mode"] == "UPI" and inv["discount"] == 3, inv


@flow("record a part payment on a bill")
def bill_payment(page, ctx):
    t = ctx["token"]
    page.goto(BASE + f"/bills/{ctx['bill_id']}")
    page.get_by_role("button", name="Record payment").click()
    amt = page.get_by_label("Amount received")
    amt.fill("75")
    page.get_by_role("button", name="Save payment").click()
    expect(page.get_by_text("₹75 recorded")).to_be_visible()
    d = api(t, f"/api/invoices/{ctx['bill_id']}")
    assert d["invoice"]["paid_amount"] == 75 and d["invoice"]["status"] == "partial", d["invoice"]


@flow("return an item from a bill")
def bill_return(page, ctx):
    t = ctx["token"]
    page.goto(BASE + f"/bills/{ctx['bill_id']}")
    page.get_by_role("button", name="Return items").click()
    page.get_by_label("Cheeni 1kg return qty").fill("1")
    page.get_by_role("button", name="Save return").click()
    expect(page.get_by_text("Return saved")).to_be_visible()
    d = api(t, f"/api/invoices/{ctx['bill_id']}")
    assert d["returns_total"] == 45, d["returns_total"]


@flow("collect udhaar from the customer page (vasuli)")
def vasuli(page, ctx):
    t = ctx["token"]
    cid = {c["name"]: c for c in api(t, "/api/customers")["customers"]}["Mohd Salim"]["id"]
    page.goto(BASE + f"/customers/{cid}")
    expect(page.get_by_text("Owes you")).to_be_visible()
    page.get_by_role("button", name="Record payment").click()
    page.get_by_label("Amount received").fill("150")
    page.get_by_role("button", name="UPI").click()
    page.get_by_role("button", name="Save payment").click()
    expect(page.get_by_text("₹150 received")).to_be_visible()
    c = api(t, f"/api/customers/{cid}")["customer"]
    assert c["pending"] == 0, c
    expect(page.get_by_text("Account settled")).to_be_visible()


@flow("share a hisab link")
def hisab(page, ctx):
    t = ctx["token"]
    cid = {c["name"]: c for c in api(t, "/api/customers")["customers"]}["Ramesh Gupta"]["id"]
    page.goto(BASE + f"/customers/{cid}")
    page.get_by_role("button", name="Share hisab link").click()
    box = page.locator(".copy-box")
    expect(box).to_contain_text("/hisab/")
    url = box.inner_text().split()[0]
    page2 = page.context.new_page()
    page2.goto(url)
    expect(page2.get_by_text("Ramesh Gupta").first).to_be_visible(timeout=8000)
    page2.close()


@flow("add a product, then it appears at the counter")
def add_product(page, ctx):
    t = ctx["token"]
    page.goto(BASE + "/products")
    page.get_by_role("button", name="Add product").first.click()
    page.get_by_label("Name").fill("Parle-G 250g")
    page.get_by_label("Buy price ₹").fill("18")
    page.get_by_label("Sell price ₹").fill("25")
    page.get_by_label("Opening stock").fill("40")
    page.locator(".drawer").get_by_role("button", name="Add product").click()
    expect(page.get_by_text("Product added")).to_be_visible()
    p = [x for x in api(t, "/api/products")["products"] if x["name"] == "Parle-G 250g"][0]
    assert p["stock_qty"] == 40 and p["sell_price"] == 25
    ctx["parle"] = p["id"]
    page.goto(BASE + "/pos")
    page.get_by_placeholder("Type an item name…").fill("parle")
    expect(page.locator(".pos-result").first).to_contain_text("Parle-G 250g")


@flow("record a purchase raises stock and supplier payable")
def purchase(page, ctx):
    t = ctx["token"]
    sup_before = {s["name"]: s for s in api(t, "/api/suppliers")["suppliers"]}["Gupta Traders"]["pending"]
    page.goto(BASE + "/purchases")
    page.get_by_role("button", name="Record purchase").first.click()
    d = page.locator(".drawer")
    d.get_by_label("Supplier", exact=True).select_option(label="Gupta Traders")
    d.get_by_label("Their bill no.").fill("GT-2001")
    d.get_by_label("Product").first.select_option(value=str(ctx["parle"]))
    d.get_by_label("Quantity").first.fill("10")
    d.get_by_label("Paid now ₹").fill("80")
    d.get_by_role("button", name="Save purchase").click()
    expect(page.get_by_text("Purchase saved")).to_be_visible()
    p = [x for x in api(t, "/api/products")["products"] if x["id"] == ctx["parle"]][0]
    assert p["stock_qty"] == 50, p["stock_qty"]
    sup_after = {s["name"]: s for s in api(t, "/api/suppliers")["suppliers"]}["Gupta Traders"]["pending"]
    assert round(sup_after - sup_before, 2) == 100, sup_after - sup_before   # 10 × 18 − 80


@flow("cancel a bill puts stock back")
def cancel_bill(page, ctx):
    t = ctx["token"]
    r = api(t, "/api/invoices", "POST", {"items": [{"product_id": ctx["parle"], "qty": 5}], "paid_amount": 125, "payment_mode": "Cash"})
    bid = r["invoice"]["id"]
    page.goto(BASE + f"/bills/{bid}")
    page.get_by_role("button", name="Cancel bill").click()
    page.get_by_label("Reason").fill("entered twice")
    page.locator(".drawer").get_by_role("button", name="Cancel bill").click()
    expect(page.get_by_text("Bill cancelled")).to_be_visible()
    p = [x for x in api(t, "/api/products")["products"] if x["id"] == ctx["parle"]][0]
    assert p["stock_qty"] == 50, p["stock_qty"]


@flow("command palette finds a customer")
def palette(page, ctx):
    page.goto(BASE + "/")
    expect(page.get_by_text("Sold today")).to_be_visible()
    page.keyboard.press("Control+k")
    box = page.get_by_role("combobox").or_(page.locator(".cmdk input")).first
    expect(box).to_be_visible()
    page.wait_for_timeout(300)  # let the palette's open-reset effect settle before typing
    box.fill("salim")
    item = page.locator(".cmdk-item span.ellipsis", has_text=re.compile(r"^Mohd Salim$"))
    try:
        expect(item).to_be_visible(timeout=5000)
    except AssertionError:
        box.fill(""); box.fill("salim")
        expect(item).to_be_visible(timeout=8000)
    page.screenshot(path=f"{SHOTS}/after-desktop-cmdk.png")
    item.click()
    page.wait_for_url("**/customers/*")


@flow("billing-only staff cannot reach stock or finance")
def staff(page, ctx):
    c2 = page.context.browser.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
    p2 = c2.new_page()
    p2.goto(BASE + "/login")
    p2.get_by_label("Email or mobile").fill("counter@businessos.app")
    p2.get_by_label("Password").fill("staff1234")
    p2.get_by_role("button", name="Log in").click()
    expect(p2.get_by_text("Sold today")).to_be_visible(timeout=8000)
    assert p2.get_by_text("Profit today").count() == 0, "staff sees profit"
    assert p2.locator(".nav-link", has_text="Products").count() == 0, "staff sees Products"
    assert p2.get_by_test_id("mode-mart").count() == 0, "billing-only staff sees Business Mart"
    p2.goto(BASE + "/products")
    p2.wait_for_url(BASE + "/")
    p2.screenshot(path=f"{SHOTS}/after-desktop-staff-home.png")
    c2.close()


@flow("Hindi switch translates the shell")
def hindi(page, ctx):
    page.goto(BASE + "/")
    page.get_by_role("button", name="हिं").click()
    expect(page.get_by_text("आज की बिक्री")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/after-desktop-home-hindi.png")
    page.get_by_role("button", name="EN").click()


with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    ctx_b = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
    page = ctx_b.new_page()
    page.on("pageerror", lambda e: console_errors.append(str(e)))
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.context.route("**/wa.me/**", lambda r: r.abort())
    state = {}
    for f in [login, pos_keyboard, pos_cash, bill_payment, bill_return, vasuli, hisab, add_product, purchase, cancel_bill, palette, staff, hindi]:
        f(page, state)
        if f is login and not state.get("token"):
            break
    b.close()

w = max(len(n) for n, _, _ in results)
for n, s, m in results:
    print(f"{s}  {n.ljust(w)}  {m}")
real_errors = [e for e in console_errors if "401" not in e and "Failed to load resource" not in e]
print("console errors:", real_errors or "none")
sys.exit(0 if all(s == "PASS" for _, s, _ in results) else 1)
