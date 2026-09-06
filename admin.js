const $=s=>document.querySelector(s), rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
let categories=[], products=[], orders=[];

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
    setTimeout(() => $("#toast").classList.remove("show"), 2200);
}

async function init() {
    try {
        const me = await api("/api/auth/me");
        if(me.user.role !== "admin") throw new Error("Bukan admin.");
    } catch(e) {
        alert(e.message || "Silakan login sebagai admin.");
        location.href = "/";
        return;
    }
    categories = await api("/api/categories");
    renderCat();
    await Promise.all([loadStats(), loadProducts(), loadOrders()]);
}

function renderCat(stats) {
    $("#pcat").innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    if(stats) {
        const targetStats = [
            ["Pendapatan", rupiah(stats.revenue)],
            ["Menunggu", stats.pending]
        ];
        $(".stats").innerHTML = targetStats.map(x => `<div class="stat"><small>${x[0]}</small><b>${x[1]}</b></div>`).join("");
    }
}

function renderProducts() {
    $("#products").innerHTML = products.map((p, i) => `<tr>
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td>${rupiah(p.price)}</td>
        <td>${p.stock}</td>
        <td><span class="pill">${p.stock > 0 ? 'Aktif' : `Stok habis: ${p.stock}`}</span></td>
        <td>
            <button onclick="editProduct('${p.id}')">Edit</button>
            <button onclick="deleteProduct('${p.id}')">Nonaktifkan</button>
        </td>
    </tr>`).join("");
}

async function loadStats() {
    const s = await api("/api/admin/stats");
    renderCat(s);
}

async function loadProducts() {
    products = await api("/api/admin/products");
    renderProducts();
}

async function loadOrders() {
    orders = await api("/api/admin/orders");
    $("#orders").innerHTML = orders.map(o => `<tr>
        <td>${o.order_code}</td>
        <td><small>${o.created_at}</small></td>
        <td>${o.customer_name}<br><small>${o.email}</small></td>
        <td>${rupiah(o.total)}</td>
        <td><span class="pill">${o.payment_status}</span></td>
        <td>
            <select onchange="setStatus('${o.id}', this.value)">
                <option value="pending" ${o.status === "pending" ? "selected" : ""}>pending</option>
                <option value="processing" ${o.status === "processing" ? "selected" : ""}>processing</option>
                <option value="shipped" ${o.status === "shipped" ? "selected" : ""}>shipped</option>
                <option value="completed" ${o.status === "completed" ? "selected" : ""}>completed</option>
                <option value="cancelled" ${o.status === "cancelled" ? "selected" : ""}>cancelled</option>
            </select>
        </td>
    </tr>`).join("");
}

function openProduct(id = null) {
    $("#productModal").classList.add("show");
    $("#productTitle").textContent = id ? "Edit Produk" : "Tambah Produk";
    $("#productForm").reset();
    $("#pid").value = "";
    $("#prating").value = 5;

    if (id) {
        const p = products.find(x => x.id === id);
        if (p) {
            $("#pid").value = p.id;
            $("#pname").value = p.name;
            $("#pcat").value = p.category;
            $("#pprice").value = p.price;
            $("#pstock").value = p.stock;
            $("#pimage").value = p.image_url;
            $("#pdesc").value = p.description;
            $("#prating").value = p.rating;
        }
    }
}

function closeProduct() {
    $("#productModal").classList.remove("show");
}

function editProduct(id) {
    openProduct(id);
}

async function deleteProduct(id) {
    if(!confirm("Nonaktifkan produk ini?")) return;
    await api(`/api/admin/products/${id}`, { method: "DELETE" });
    toast("Produk dinonaktifkan.");
    loadProducts();
    loadStats();
}

async function saveProduct(e) {
    e.preventDefault();
    const body = {
        name: $("#pname").value,
        category_id: $("#pcat").value,
        price: Number($("#pprice").value),
        stock: Number($("#pstock").value),
        image_url: $("#pimage").value,
        description: $("#pdesc").value,
        rating: Number($("#prating").value)
    };
    const id = $("#pid").value;
    const url = id ? `/api/admin/products/${id}` : "/api/admin/products";
    const method = id ? "PUT" : "POST";

    await api(url, { method, body: JSON.stringify(body) });
    closeProduct();
    toast("Produk disimpan.");
    loadProducts();
    loadStats();
}

async function setStatus(id, status) {
    await api(`/api/admin/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
    });
    toast("Status pesanan diperbarui.");
    loadOrders();
}

$("#productForm").onsubmit = saveProduct;
$(".close").onclick = closeProduct;
init();
     
