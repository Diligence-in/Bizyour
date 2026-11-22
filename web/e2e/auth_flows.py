"""Signup → email code → shop setup, and forgot → code → new password.

The server must run WITHOUT mail settings (dev mode) and write its output to
the log file given as argv[3]; codes are read from its [DEV-MAIL] lines,
exactly where a local demo user would find them.

    python3 -I web/e2e/auth_flows.py http://localhost:4100 /shots /path/server.log
"""
import json, re, sys, time, urllib.request
from playwright.sync_api import sync_playwright, expect

BASE, SHOTS, LOG = sys.argv[1], sys.argv[2], sys.argv[3]
results, errors = [], []
EMAIL, MOBILE = f"newshop{int(time.time()) % 100000}@example.com", f"9{int(time.time()) % 1000000000:09d}"


def last_code(email, purpose_word):
    for _ in range(30):
        lines = [l for l in open(LOG, encoding="utf-8", errors="ignore") if "[DEV-MAIL]" in l and email in l and purpose_word in l]
        if lines:
            return re.search(r"code is (\d{6})", lines[-1]).group(1)
        time.sleep(0.3)
    raise AssertionError(f"no {purpose_word} code for {email} in server log")


def step(name, fn, page):
    try:
        fn(page); results.append((name, "PASS", ""))
    except Exception as e:  # noqa: BLE001
        page.screenshot(path=f"{SHOTS}/fail-auth-{re.sub(r'[^a-z]+', '_', name.lower())}.png")
        results.append((name, "FAIL", str(e).splitlines()[0][:300]))


def visitor(p):
    p.goto(BASE + "/")
    expect(p.get_by_test_id("intro")).to_be_visible()             # logo intro first
    p.screenshot(path=f"{SHOTS}/after-desktop-intro.png")
    expect(p.get_by_test_id("intro")).to_have_count(0, timeout=6000)
    expect(p.get_by_role("heading", name="Your whole shop, in one app.")).to_be_visible()
    expect(p.locator("#pricing")).to_contain_text("Free")
    expect(p.locator("#pricing")).to_contain_text("30 days free")
    p.screenshot(path=f"{SHOTS}/after-desktop-landing.png")
    p.screenshot(path=f"{SHOTS}/after-desktop-landing-full.png", full_page=True)
    p.reload()                                                     # intro plays once per visit
    expect(p.get_by_role("heading", name="Your whole shop, in one app.")).to_be_visible()
    assert p.get_by_test_id("intro").count() == 0, "intro played twice"


def signup(p):
    p.get_by_test_id("hero-signup").click()
    expect(p).to_have_url(BASE + "/signup")
    p.screenshot(path=f"{SHOTS}/after-desktop-signup.png")
    p.get_by_label("Your name").fill("Gupta Ji")
    p.get_by_label("Email").fill(EMAIL)
    p.get_by_label("Mobile number").fill(MOBILE)
    p.get_by_label("Password").fill("short")
    p.get_by_role("button", name="Create account").click()
    expect(p.get_by_text("at least 8 characters").first).to_be_visible()
    p.get_by_label("Password").fill("gupta12345")
    p.get_by_role("button", name="Create account").click()
    expect(p.get_by_role("heading", name="Check your email")).to_be_visible()
    expect(p.get_by_text("[DEV-MAIL]")).to_be_visible()   # honest local-demo note
    p.screenshot(path=f"{SHOTS}/after-desktop-verify.png")


def wrong_then_right_code(p):
    code = last_code(EMAIL, "verify")
    wrong = "000000" if code != "000000" else "111111"
    p.get_by_label("6-digit code").fill(wrong)
    expect(p.get_by_text("tries left")).to_be_visible()
    p.get_by_label("6-digit code").fill(code)          # auto-submits at 6 digits
    expect(p.get_by_role("heading", name="Set up your shop")).to_be_visible(timeout=8000)
    p.screenshot(path=f"{SHOTS}/after-desktop-setup.png")


def setup(p):
    expect(p.get_by_label("Owner name")).to_have_value("Gupta Ji")
    p.get_by_label("Shop name").fill("Gupta Kirana Store")
    p.get_by_label("City").fill("Gurugram")
    p.get_by_role("radio", name=re.compile("Hinglish")).click()
    p.get_by_role("button", name="Save and open my shop").click() if p.get_by_role("button", name="Save and open my shop").count() else p.locator(".setup-card button[type=submit]").click()
    p.wait_for_url("**/welcome", timeout=8000)                    # Workspace | Business Mart, side by side
    expect(p.get_by_test_id("door-mart")).to_contain_text("Hamesha free")
    expect(p.get_by_test_id("door-workspace")).to_contain_text(re.compile(r"Trial · (29|30) din baaki"))
    p.get_by_role("button", name="EN", exact=True).click()
    expect(p.get_by_test_id("door-mart")).to_contain_text("Free, always")
    p.screenshot(path=f"{SHOTS}/after-desktop-welcome.png")
    p.get_by_test_id("door-mart").click()
    p.wait_for_url("**/mart")
    expect(p.get_by_test_id("mode-mart")).to_have_attribute("aria-selected", "true")
    expect(p.get_by_text("Business Mart is free, always.")).to_be_visible()
    assert p.locator(".sidebar .nav-link", has_text="New bill").count() == 0, "Workspace items shown in Mart mode"
    p.screenshot(path=f"{SHOTS}/after-desktop-mart-mode.png")
    p.get_by_test_id("mode-workspace").click()
    p.wait_for_url(BASE + "/")
    expect(p.get_by_text(re.compile(r"Workspace trial · (29|30) days left"))).to_be_visible()
    assert p.locator(".sidebar .nav-link", has_text="Browse wholesalers").count() == 0, "Mart items shown in Workspace mode"
    p.get_by_test_id("mode-mart").click()                          # switch remembers where you were
    p.wait_for_url("**/mart")
    p.get_by_test_id("mode-workspace").click()
    expect(p.locator(".biz-name")).to_have_text("Gupta Kirana Store", timeout=8000)
    tok = p.evaluate("localStorage.getItem('bos_token')")
    req = urllib.request.Request(BASE + "/api/subscription", headers={"Authorization": f"Bearer {tok}"})
    sub = json.loads(urllib.request.urlopen(req).read())["subscription"]
    assert sub["status"] == "trial" and sub["days_left"] >= 29, sub
    req = urllib.request.Request(BASE + "/api/business", headers={"Authorization": f"Bearer {tok}"})
    biz = json.loads(urllib.request.urlopen(req).read())["business"]
    assert biz["language"] == "hg" and biz["city"] == "Gurugram", biz


def forgot_reset(p):
    p.get_by_role("button", name="Log out").click()
    expect(p.get_by_role("heading", name="Log in to your shop")).to_be_visible()
    p.get_by_label("Email or mobile").fill(EMAIL)
    p.get_by_role("link", name="Forgot password?").click()
    expect(p.get_by_label("Email")).to_have_value(EMAIL)
    p.get_by_role("button", name="Send code").click()
    expect(p.get_by_role("heading", name=re.compile("Enter the code"))).to_be_visible()
    code = last_code(EMAIL, "reset")
    p.get_by_label("6-digit code").fill(code)
    p.get_by_label("New password").fill("newpass9876")
    p.screenshot(path=f"{SHOTS}/after-desktop-reset.png")
    p.get_by_role("button", name="Save password and log in").click()
    p.wait_for_url("**/welcome", timeout=8000)
    p.get_by_test_id("door-workspace").click()
    expect(p.locator(".biz-name")).to_have_text("Gupta Kirana Store", timeout=8000)
    p.get_by_role("button", name="Log out").click()
    p.get_by_label("Email or mobile").fill(MOBILE)             # mobile login works too
    p.get_by_label("Password").fill("newpass9876")
    p.get_by_role("button", name="Log in").click()
    p.wait_for_url("**/welcome", timeout=8000)
    p.get_by_test_id("door-workspace").click()
    expect(p.locator(".biz-name")).to_have_text("Gupta Kirana Store", timeout=8000)
    p.get_by_role("button", name="Log out").click()


def mobile_shots(p):
    c = p.context.browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers="block")
    m = c.new_page()
    m.add_init_script("sessionStorage.setItem('bos_intro_seen','1')")
    m.goto(BASE + "/")
    expect(m.get_by_role("heading", name="Your whole shop, in one app.")).to_be_visible()
    m.screenshot(path=f"{SHOTS}/after-mobile-landing.png")
    m.goto(BASE + "/login")
    m.get_by_label("Email or mobile").fill(EMAIL)
    m.get_by_label("Password").fill("newpass9876")
    m.get_by_role("button", name="Log in").click()
    m.wait_for_url("**/welcome", timeout=8000)
    m.screenshot(path=f"{SHOTS}/after-mobile-welcome.png", full_page=True)
    m.get_by_test_id("door-mart").click()
    m.wait_for_url("**/mart")
    expect(m.locator(".bottombar-mart")).to_be_visible()
    m.screenshot(path=f"{SHOTS}/after-mobile-mart-mode.png")
    m.get_by_test_id("mode-workspace").click()
    expect(m.locator(".bottombar .bottom-primary")).to_be_visible()
    c.close()


def unverified_login(p):
    em = "pending" + EMAIL
    req = urllib.request.Request(BASE + "/api/auth/signup", method="POST", headers={"Content-Type": "application/json"},
                                 data=json.dumps({"name": "P", "email": em, "mobile": "8" + MOBILE[1:], "password": "pending123"}).encode())
    urllib.request.urlopen(req)
    p.get_by_label("Email or mobile").fill(em)
    p.get_by_label("Password").fill("pending123")
    p.get_by_role("button", name="Log in").click()
    expect(p.get_by_role("heading", name="Check your email")).to_be_visible()
    expect(p).to_have_url(re.compile(r"/verify\?email="))


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/usr/bin/google-chrome")
    c = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
    pg = c.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    for name, fn in [("visitor: logo intro → public home page", visitor), ("signup form → check-your-email screen", signup), ("wrong code is refused, right code opens setup", wrong_then_right_code),
                     ("setup → Workspace | Business Mart doors → switch both ways", setup), ("forgot password → code → new password → logged in", forgot_reset), ("phone: home page, doors, Mart bottom bar", mobile_shots),
                     ("unconfirmed account logging in is sent to the code screen", unverified_login)]:
        step(name, fn, pg)
    b.close()

w = max(len(n) for n, _, _ in results)
for n, s, m in results:
    print(f"{s}  {n.ljust(w)}  {m}")
print("console errors:", errors or "none")
sys.exit(0 if all(s == "PASS" for _, s, _ in results) else 1)
