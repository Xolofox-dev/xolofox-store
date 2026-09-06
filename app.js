const $=s=>document.querySelector(s), rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
let products=[], categories=[], activeCategory="Semua";
let cart=JSON.parse(localStorage.getItem("xolofox_cart"))||[];
let me=null, authMode="login";

async function api(url, opt={}) {
    const r = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(opt.headers || {}) },
        ...opt
    });
    const d = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.message || "Terjadi kesalahan.");
    return d;
}

function toast(t) {
    $("#toast").textContent = t;
    $("#toast").classList.add("show");
    clearTimeout(window.tt);
    window.tt = setTimeout(() => $("#toast").classList.remove("show"), 2500);
}

function saveCart() { localStorage.setItem("xolofox_cart", JSON.stringify(cart)); renderCart(); }
function cartCount() { return cart.reduce((s, x) => s + x.quantity, 0); }
function productById(id) { return products.find(p => p.id === id); }

function addToCart(id) {
    const p = productById(id); if(!p || p.stock <= 0) return toast("Stok produk habis.");
    const x = cart.find(i => i.product_id === id);
    if(x) {
        if(x.quantity >= p.stock) return toast("Jumlah melebihi stok.");
        x.quantity++;
    } else {
        cart.push({ product_id: id, quantity: 1 });
    }
    saveCart(); toast("Produk ditambahkan 🛒");
}

function changeQty(id, d) {
    const x = cart.find(i => i.product_id === id); if(!x) return;
    const p = productById(id); if(!p) return;
    x.quantity += d;
    if(x.quantity <= 0) cart = cart.filter(i => i.product_id !== id);
    if(p && x.quantity > p.stock) x.quantity = p.stock;
    saveCart();
}

function removeItem(id) { cart = cart.filter(x => x.product_id !== id); saveCart(); }

function renderCart() {
    $("#cartBadge").textContent = cartCount();
    if(!cart.length) { $("#cartList").innerHTML = '<div class="cart-empty">Keranjang masih kosong 🛍️</div>'; $("#cartFooter").innerHTML = ""; return; }
    let total = 0;
    $("#cartList").innerHTML = cart.map(x => {
        const p = productById(x.product_id); if(!p) return "";
        total += p.price * x.quantity;
        return `<div class="cart-item">
            <img src="${p.image_url}" class="cart-thumb" alt="${p.name}">
            <div class="cart-info">
                <h4>${p.name}</h4>
                <small>${rupiah(p.price)} x ${x.quantity}</small>
            </div>
            <div class="cart-qty">
                <button onclick="changeQty('${p.id}',-1)">-</button>
                <span>${x.quantity}</span>
                <button onclick="changeQty('${p.id}',1)">+</button>
                <button onclick="removeItem('${p.id}')" class="remove-btn">Hapus</button>
            </div>
        </div>`;
    }).join("");
    $("#cartFooter").innerHTML = `<div class="cart-total"><span>Total:</span><span>${rupiah(total)}</span></div><button class="checkout-btn" onclick="openCheckout()">Lanjut Checkout</button>`;
}

function renderCategories() {
    $("#kategori").innerHTML = `<button class="cat ${activeCategory==="Semua"?"active":""}" onclick="setCat('Semua')">Semua</button>` + 
    categories.map(c => `<button class="cat ${activeCategory===c.name?"active":""}" onclick="setCat('${c.name.replace(/'/g,"\\'")}')">${c.name}</button>`).join("");
}

function setCat(c) { activeCategory = c; renderCategories(); renderProducts(); }

function renderProducts() {
    const searchInput = $("#search");
    const q = searchInput ? searchInput.value.toLowerCase() : "";
    const list = products.filter(p => (activeCategory === "Semua" || p.category === activeCategory) && (p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q))));
    
    if(!list.length) { $("#products").innerHTML = '<div class="notice" style="grid-column:1/-1;">Produk tidak ditemukan.</div>'; return; }
    $("#products").innerHTML = list.map(p => `<article class="product">
        <span class="cat">${p.category}</span>
        <img src="${p.image_url}" alt="${p.name}">
        <div class="product-info">
            <h3>${p.name}</h3>
            <div class="rating">★★★★★</div>
            <div class="price-row">
                <span class="price">${rupiah(p.price)}</span>
                <button onclick="addToCart('${p.id}')">+ Tambah ke Keranjang</button>
            </div>
        </div>
    </article>`).join("");
}

async function loadStore() {
    [products, categories] = await Promise.all([api("/api/products"), api("/api/categories")]);
    renderCategories(); renderProducts(); renderCart();
    try { const r = await api("/api/auth/me"); me = r.user; } catch(e) { me = null; }
    updateAuthUI(); loadOrders();
}

function updateAuthUI() {
    if(me) {
        $("#authBtn").textContent = "🚪 Keluar (" + me.name + ")";
        $("#userLabel").textContent = me.role === "admin" ? "🛠️ Admin Dashboard" : "";
        if(me.role === "admin") { $("#userLabel").onclick = () => location.href = "/admin.html"; }
        else { $("#userLabel").onclick = null; }
        $("#authBtn").onclick = logout;
    } else {
        $("#authBtn").textContent = "👤 Login";
        $("#userLabel").textContent = "";
        $("#authBtn").onclick = () => openAuth("login");
    }
}

function openAuth(mode="login") { authMode = mode; $("#authModal").classList.add("show"); switchAuth(mode); }
function closeProduct() { $(".modal").classList.remove("show"); }

function switchAuth(mode) {
    authMode = mode; const isLogin = mode === "login";
    $("#loginTab").classList.toggle("active", isLogin); $("#registerTab").classList.toggle("active", !isLogin);
    $("#nameGroup").style.display = isLogin ? "none" : "block"; $("#name").required = !isLogin;
    $("#authTitle").textContent = isLogin ? "Selamat Datang" : "Buat Akun Baru";
    $("#authSub").textContent = isLogin ? "Login untuk melanjutkan belanja." : "Daftar akun gratis untuk mulai berbelanja.";
    $("#authSubmit").textContent = isLogin ? "Login" : "Daftar"; $("#formMsg").textContent = "";
}

async function submitAuth(e) {
    e.preventDefault(); $("#formMsg").textContent = "";
    try {
        const body = { email: $("#email").value, password: $("#password").value };
        if(authMode === "register") Object.assign(body, { name: $("#name").value });
        const r = await api(`/api/auth/${authMode}`, { method: "POST", body: JSON.stringify(body) });
        me = r.user; $(".modal").classList.remove("show"); updateAuthUI(); loadStore(); toast(authMode === "login" ? "Login berhasil 👋" : "Akun berhasil dibuat ✨");
    } catch(e) { $("#formMsg").textContent = e.message; $("#formMsg").style.color = "#e53935"; }
}

async function logout() { await api("/api/auth/logout", { method: "POST" }); me = null; updateAuthUI(); loadStore(); toast("Kamu sudah logout 👋"); }

function openCheckout() {
    if(!me) { $("#cartDrawer").classList.remove("show"); openAuth("login"); return toast("Silakan login terlebih dahulu."); }
    if(!cart.length) return toast("Keranjang masih kosong.");
    $("#checkoutModal").classList.add("show");
    let total = cart.reduce((s, x) => s + (productById(x.product_id)?.price || 0) * x.quantity, 0);
    $("#checkoutSummary").innerHTML = `<b>Total Pembayaran: ${rupiah(total)}</b><br><small>Pembayaran akan menggunakan Midtrans.</small>`;
    $("#cName").value = me.name;
}

async function checkout(e) {
    e.preventDefault(); $("#checkoutMsg").textContent = "";
    try {
        const body = {
            customer_name: $("#cName").value, phone: $("#cPhone").value, address: $("#cAddress").value, city: $("#cCity").value, postal_code: $("#cPostal").value, items: cart
        };
        const r = await api("/api/orders", { method: "POST", body: JSON.stringify(body) });
        cart = []; saveCart(); $("#checkoutModal").classList.remove("show"); loadStore();
        if(r.payment_ready) { toast("Pesanan dibuat, silakan selesaikan pembayaran."); payMidtrans(r.client_key, r.order_id); }
    } catch(e) { $("#checkoutMsg").textContent = e.message; $("#checkoutMsg").style.color = "#e53935"; }
}

function payMidtrans(clientKey, orderId) {
    if(window.snap) { window.snap.pay(orderId); return; }
    const scr = document.createElement("script");
    scr.src = location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "https://midtrans.com" : "https://midtrans.com";
    scr.setAttribute("data-client-key", clientKey);
    scr.onload = () => window.snap.pay(orderId);
    document.head.appendChild(scr);
}

async function loadOrders() {
    if(!me) { $("#orders").innerHTML = '<div class="notice">Login untuk melihat riwayat pesanan.</div>'; return; }
    try {
        const o = await api("/api/orders");
        if(!o.length) { $("#orders").innerHTML = '<div class="notice">Belum ada pesanan.</div>'; return; }
        $("#orders").innerHTML = o.map(x => `<div class="order-card">
            <b>#${x.order_code}</b> - <span class="status ${x.status}">${x.status}</span><br>
            <small style="color:#718096;">${x.created_at}</small><hr>
            ${x.items.map(i => `${i.product_name} x ${i.quantity} (${rupiah(i.price * i.quantity)})`).join("<br>")}
            <hr><b>Total: ${rupiah(x.total)}</b>
        </div>`).join("");
    } catch(e) { $("#orders").innerHTML = '<div class="notice">Gagal memuat riwayat pesanan.</div>'; }
}

// Event Listeners
$("#loginTab").onclick = () => switchAuth("login");
$("#registerTab").onclick = () => switchAuth("register");
$("#authForm").onsubmit = submitAuth;
$("#checkoutForm").onsubmit = checkout;
$("#cartBtn").onclick = () => $("#cartDrawer").classList.add("show");
$("#search").oninput = renderProducts;

document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => $(b.dataset.close).classList.remove("show"));
loadStore();
                                                                                                                                                                                             
