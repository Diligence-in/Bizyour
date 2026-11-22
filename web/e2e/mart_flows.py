"""Business Mart end-to-end: two real browsers (a shop buying, a wholesaler
selling) run the full loop, and every step is checked through the API.

    python3 -I web/e2e/mart_flows.py http://localhost:4100 /path/to/shots
"""
import base64, json, os, re, sys, tempfile, urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4100"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else "/tmp"
results, errors, S = [], [], {}


def api(token, path, method="GET", body=None):
    req = urllib.request.Request(BASE + path, method=method, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                                 data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def step(name, fn):
    try:
        fn(); results.append((name, "PASS", ""))
    except Exception as e:  # noqa: BLE001
        for k in ("buyer", "seller"):
            if k in S: S[k].screenshot(path=f"{SHOTS}/fail-mart-{k}-{re.sub(r'[^a-z]+', '_', name.lower())}.png")
        results.append((name, "FAIL", str(e).splitlines()[0][:300]))


def ui_login(page, who, pw="demo1234"):
    page.goto(BASE + "/login")
    page.get_by_label("Email or mobile").fill(who)
    page.get_by_label("Password").fill(pw)
    page.get_by_role("button", name="Log in").click()
    # owners see the Workspace | Business Mart doors; one-sided staff skip them
    page.get_by_test_id("door-workspace").or_(page.get_by_text("Sold today")).first.wait_for(timeout=8000)
    if page.get_by_test_id("door-workspace").count():
        page.get_by_test_id("door-workspace").click()
    expect(page.get_by_text("Sold today")).to_be_visible(timeout=8000)
    return page.evaluate("localStorage.getItem('bos_token')")


def restock_request():
    b = S["buyer"]
    surf = [p for p in api(S["bt"], "/api/products")["products"] if p["name"] == "Surf Excel 1kg"][0]
    S["surf_stock"] = surf["stock_qty"]
    b.goto(BASE + "/mart")
    row = b.locator(".restock-row", has_text="Surf Excel 1kg")
    row.get_by_role("button", name=re.compile("Get quotes")).click()
    d = b.locator(".drawer")
    expect(d.get_by_label("What do you need?")).to_have_value("Surf Excel 1kg")
    d.get_by_label("Quantity").fill("24")
    expect(d).to_contain_text("sellers will be told")
    d.get_by_role("button", name="Post request").click()
    b.wait_for_url(re.compile(r"/mart/requests/\d+"))
    S["inq"] = int(b.url.rsplit("/", 1)[1])
    inq = api(S["bt"], f"/api/mart/inquiries/{S['inq']}")["inquiry"]
    assert inq["product_id"] == surf["id"] and inq["source"] == "stock" and inq["qty"] == 24 and inq["category"] == "FMCG", inq
    assert inq["notified"] >= 1, inq


def seller_quotes():
    s = S["seller"]
    s.goto(BASE + "/mart/sell")
    s.locator(".lead-row", has_text="24 pack Surf Excel 1kg").click()
    d = s.locator(".drawer")
    d.get_by_label(re.compile("Your price")).fill("108")
    d.get_by_label("Delivery in (days)").fill("1")
    d.get_by_label("Note for the buyer").fill("Fresh stock, delivered tomorrow")
    d.get_by_role("button", name=re.compile("Send quote")).click()
    expect(s.get_by_text("Quote sent")).to_be_visible()
    q = [x for x in api(S["st"], "/api/mart/quotes-sent")["quotes"] if x["inquiry_id"] == S["inq"]][0]
    assert q["price"] == 108 and q["delivery_days"] == 1 and q["status"] == "sent", q
    S["quote"] = q["id"]
    s.keyboard.press("Escape")


def buyer_counters():
    b = S["buyer"]
    b.goto(BASE + f"/mart/requests/{S['inq']}")
    expect(b.locator(".compare, .quote-card").first).to_contain_text("Fresh Supply Co")
    b.screenshot(path=f"{SHOTS}/after-desktop-mart-request-quote.png")
    b.get_by_role("button", name=re.compile("Chat")).first.click()
    d = b.locator(".drawer")
    d.get_by_label("Counter price").fill("100")
    d.get_by_role("button", name="Send counter-offer").click()
    expect(d.locator(".bubble-offer")).to_contain_text("₹100")
    b.screenshot(path=f"{SHOTS}/after-desktop-mart-chat.png")
    msgs = api(S["bt"], f"/api/mart/quotes/{S['quote']}/messages")["messages"]
    assert msgs[-1]["kind"] == "counter" and msgs[-1]["amount"] == 100, msgs
    b.keyboard.press("Escape")


def seller_updates_price():
    s = S["seller"]
    s.goto(BASE + "/mart/notifications")
    s.locator(".notif", has_text="counter-offered").first.click()   # notification → chat deep link
    d = s.locator(".drawer")
    expect(d.locator(".bubble-offer")).to_contain_text("₹100")
    d.get_by_label("New price").fill("102")
    d.get_by_role("button", name="Update price").click()
    expect(d.locator(".bubble-offer").last).to_contain_text("₹102")
    q = api(S["st"], f"/api/mart/quotes/{S['quote']}/messages")["quote"]
    assert q["price"] == 102, q


def buyer_accepts():
    b = S["buyer"]
    b.goto(BASE + f"/mart/requests/{S['inq']}")
    expect(b.locator(".compare-price, .quote-card").first).to_contain_text("₹102")
    b.get_by_role("button", name=re.compile("^Accept")).first.click()
    m = b.locator(".modal")
    expect(m).to_contain_text("₹2,448")   # 24 × 102
    m.get_by_role("button", name="Place order").click()
    b.wait_for_url(re.compile(r"/mart/orders\?open=\d+"))
    S["order"] = int(b.url.split("open=")[1])
    o = [x for x in api(S["bt"], "/api/mart/orders?role=buyer")["orders"] if x["id"] == S["order"]][0]
    assert o["status"] == "placed" and o["total"] == 2448 and o["price"] == 102, o


def seller_confirms_dispatches():
    s = S["seller"]
    s.goto(BASE + f"/mart/orders?tab=seller&open={S['order']}")
    d = s.locator(".drawer")
    d.get_by_role("button", name="Confirm order").click()
    expect(s.get_by_text("Order confirmed")).to_be_visible()
    d.get_by_role("button", name="Mark dispatched").click()
    d.get_by_label("Transporter (optional)").fill("Sharma Tempo")
    d.locator(".action-box").get_by_role("button", name="Mark dispatched").click()
    expect(s.get_by_text("Marked dispatched")).to_be_visible()
    o = [x for x in api(S["st"], "/api/mart/orders?role=seller")["orders"] if x["id"] == S["order"]][0]
    assert o["status"] == "dispatched" and o["transporter_name"] == "Sharma Tempo", o


def buyer_receives():
    b = S["buyer"]
    b.goto(BASE + f"/mart/orders?open={S['order']}")
    d = b.locator(".drawer")
    expect(d).to_contain_text("Sharma Tempo")
    d.get_by_role("button", name="Goods received").click()
    d.get_by_label("Paid already ₹").fill("1000")
    d.get_by_role("button", name="Yes, add to my stock").click()
    expect(b.get_by_text("purchase and stock updated")).to_be_visible()
    surf = [p for p in api(S["bt"], "/api/products")["products"] if p["name"] == "Surf Excel 1kg"][0]
    assert surf["stock_qty"] == S["surf_stock"] + 24, (surf["stock_qty"], S["surf_stock"])
    pur = [p for p in api(S["bt"], "/api/purchases")["purchases"] if p["bill_no"].startswith("BM-")][0]
    assert pur["total"] == 2448 and pur["paid_amount"] == 1000, pur
    d.get_by_role("button", name="Rate seller").click()
    d.get_by_role("radio", name="5").click()
    d.get_by_role("button", name="Save rating").click()
    expect(b.get_by_text("rating saved")).to_be_visible()
    o = [x for x in api(S["bt"], "/api/mart/orders?role=buyer")["orders"] if x["id"] == S["order"]][0]
    assert o["status"] == "delivered" and o["rating"] == 5, o
    b.screenshot(path=f"{SHOTS}/after-desktop-mart-order.png")


def seller_catalog_photo():
    s = S["seller"]
    png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWMXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC")
    path = os.path.join(tempfile.mkdtemp(), "ghee.png")
    open(path, "wb").write(png)
    s.goto(BASE + "/mart/sell?tab=catalog")
    s.get_by_role("button", name="Add product").click()
    d = s.locator(".drawer")
    d.locator("input[type=file]").set_input_files(path)
    expect(d.locator(".photo-pick img")).to_be_visible()
    d.get_by_label("Product name").fill("Desi Ghee 1L")
    d.get_by_label("Category").select_option("Oil & Ghee")
    d.get_by_label("Unit").select_option("tin")
    d.get_by_label("Wholesale price ₹").fill("540")
    d.get_by_label("Minimum order").fill("12")
    d.get_by_role("button", name="Add", exact=True).click()
    expect(s.get_by_text("Added to your catalog")).to_be_visible()
    l = [x for x in api(S["st"], "/api/mart/my-listings")["listings"] if x["name"] == "Desi Ghee 1L"][0]
    assert l["photo"] and l["photo"].startswith("data:image/jpeg"), "photo not stored"
    S["seller"].screenshot(path=f"{SHOTS}/after-desktop-mart-catalog.png")


def buyer_browses_and_favourites():
    b = S["buyer"]
    b.goto(BASE + "/mart/browse")
    b.get_by_role("button", name="Oil & Ghee").click()
    card = b.locator(".listing-card", has_text="Desi Ghee 1L")
    expect(card.locator("img")).to_be_visible()
    card.locator(".listing-seller").click()
    b.wait_for_url(re.compile(r"/mart/sellers/\d+"))
    expect(b.get_by_text("What buyers say")).to_be_visible()
    expect(b.locator(".list-row", has_text="Fresh stock").or_(b.locator(".list-row", has_text="★★★★★")).first).to_be_visible()
    b.get_by_role("button", name="Add to my wholesalers").click()
    expect(b.get_by_text("Added to my wholesalers")).to_be_visible()
    favs = api(S["bt"], "/api/mart/favourites")["favourites"]
    assert any(f["name"] == "Fresh Supply Co" for f in favs), favs


def bulk_request_compare():
    b = S["buyer"]
    b.goto(BASE + "/mart")
    b.get_by_role("button", name="Ask for quotes").click()
    d = b.locator(".drawer")
    d.get_by_label("What do you need?").fill("Toor Dal")
    d.get_by_label("Category").select_option("Staples")
    d.get_by_label("Quantity").fill("200")
    d.locator("label.check", has_text="Only sellers I pick").click()
    d.locator(".pick", has_text="Fresh Supply Co").locator("input").check()
    d.locator(".pick", has_text="Annapurna Rice Mills").locator("input").check()
    d.get_by_role("button", name="Post request").click()
    b.wait_for_url(re.compile(r"/mart/requests/\d+"))
    gid = api(S["bt"], f"/api/mart/inquiries/{b.url.rsplit('/', 1)[1]}")["inquiry"]["group_id"]
    sibs = [i for i in api(S["bt"], "/api/mart/inquiries")["inquiries"] if i["group_id"] == gid]
    assert len(sibs) == 2 and {i["target_business_id"] for i in sibs}, sibs
    # both sellers quote through the API, then the buyer sees ONE comparison
    rt = api_login("rice@bizyour.demo")
    for tok, inq in ((S["st"], next(i for i in sibs if i["target_business_id"] != 3)), (rt, next(i for i in sibs if i["target_business_id"] == 3))):
        api(tok, f"/api/mart/inquiries/{inq['id']}/quotes", "POST", {"price": 120 if tok == rt else 118, "delivery_days": 2, "payment_terms": "Cash on delivery"})
    b.reload()
    expect(b.get_by_text("Sent privately to 2 sellers")).to_be_visible()
    expect(b.locator(".compare thead th")).to_have_count(3)   # label column + 2 sellers
    b.screenshot(path=f"{SHOTS}/after-desktop-mart-bulk-compare.png")


def api_login(who):
    req = urllib.request.Request(BASE + "/api/auth/login", method="POST", headers={"Content-Type": "application/json"}, data=json.dumps({"identifier": who, "password": "demo1234"}).encode())
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["token"]


def staff_no_mart():
    c = S["browser"].new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
    p = c.new_page()
    ui_login(p, "counter@businessos.app", "staff1234")
    assert p.locator(".nav-link", has_text="Buy & restock").count() == 0, "billing staff sees Mart"
    p.goto(BASE + "/mart"); p.wait_for_url(BASE + "/")
    c.close()


with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome")
    S["browser"] = br
    for who, key in (("demo@businessos.app", "buyer"), ("fresh@bizyour.demo", "seller")):
        ctx = br.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
        ctx.route("**/wa.me/**", lambda r: r.abort())
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "401" not in m.text else None)
        S[key] = pg
        S["bt" if key == "buyer" else "st"] = ui_login(pg, who)
    for name, fn in [
        ("buyer posts a restock request from low stock", restock_request),
        ("matched seller sees the lead and quotes", seller_quotes),
        ("buyer compares and sends a counter-offer", buyer_counters),
        ("seller opens the notification and updates price", seller_updates_price),
        ("buyer accepts → order placed", buyer_accepts),
        ("seller confirms and dispatches", seller_confirms_dispatches),
        ("buyer marks received → purchase + stock, then rates", buyer_receives),
        ("seller adds a catalog item with a photo", seller_catalog_photo),
        ("buyer browses, opens seller, adds to favourites", buyer_browses_and_favourites),
        ("request to picked sellers → one comparison", bulk_request_compare),
        ("billing-only staff cannot open Mart", staff_no_mart),
    ]:
        step(name, fn)
    br.close()

w = max(len(n) for n, _, _ in results)
for n, s, m in results:
    print(f"{s}  {n.ljust(w)}  {m}")
real = [e for e in errors if "Failed to load resource" not in e]
print("console errors:", real or "none")
sys.exit(0 if all(s == "PASS" for _, s, _ in results) else 1)
