const $=s=>document.querySelector(s);
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
let products=[],categories=[],activeCategory="Semua";
let cart=JSON.parse(localStorage.getItem("xolofox_cart")||"[]");
let me=null, authMode="login";

async function api(url,options={}) {
  const r=await fetch(url,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.message||"Terjadi kesalahan.");
  return data;
}
function toast(t){const x=$("#toast");x.textContent=t;x.classList.add("show");clearTimeout(window.tt);window.tt=setTimeout(()=>x.classList.remove("show"),2500)}
function saveCart(){localStorage.setItem("xolofox_cart",JSON.stringify(cart));renderCart()}
function cartCount(){return cart.reduce((s,x)=>s+x.quantity,0)}
function productById(id){return products.find(p=>p.id===id)}
function addToCart(id){
  const p=productById(id); if(!p||p.stock<1)return toast("Stok produk habis.");
  const x=cart.find(i=>i.product_id===id);
  if(x){if(x.quantity>=p.stock)return toast("Jumlah melebihi stok.");x.quantity++}else cart.push({product_id:id,quantity:1});
  saveCart();toast("Produk ditambahkan 🛒");
}
function changeQty(id,d){
  const x=cart.find(i=>i.product_id===id);if(!x)return;
  const p=productById(id);x.quantity+=d;
  if(x.quantity<=0)cart=cart.filter(i=>i.product_id!==id);
  if(p&&x.quantity>p.stock)x.quantity=p.stock;
  saveCart();
}
function removeItem(id){cart=cart.filter(x=>x.product_id!==id);saveCart()}
function renderCart(){
  $("#cartBadge").textContent=cartCount();
  if(!cart.length){$("#cartList").innerHTML='<div class="cart-empty">Keranjang masih kosong 🛒</div>';$("#cartFooter").innerHTML="";return}
  let total=0;
  $("#cartList").innerHTML=cart.map(x=>{
    const p=productById(x.product_id);if(!p)return "";
    total+=p.price*x.quantity;
    return `<div class="cart-item"><div class="cart-thumb">${p.image_url?`<img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`: "🛍️"}</div><div class="cart-info"><b>${p.name}</b><small>${rupiah(p.price)}</small><div class="qty"><button onclick="changeQty(${p.id},-1)">−</button><span>${x.quantity}</span><button onclick="changeQty(${p.id},1)">+</button></div><button class="remove" onclick="removeItem(${p.id})">Hapus</button></div></div>`
  }).join("");
  $("#cartFooter").innerHTML=`<div class="cart-total"><span>Total</span><span>${rupiah(total)}</span></div><button class="checkout-btn" onclick="openCheckout()">Lanjut Checkout</button>`;
}
function renderCategories(){
  $("#kategori").innerHTML=[`<button class="cat ${activeCategory==="Semua"?"active":""}" onclick="setCat('Semua')">Semua</button>`,...categories.map(c=>`<button class="cat ${activeCategory===c.name?"active":""}" onclick="setCat('${c.name.replaceAll("'","\\'")}')">${c.name}</button>`)].join("");
}
function setCat(c){activeCategory=c;renderCategories();renderProducts()}
function renderProducts(){
  const q=$("#search").value.toLowerCase();
  const list=products.filter(p=>(activeCategory==="Semua"||p.category===activeCategory)&&(p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q)));
  $("#products").innerHTML=list.length?list.map(p=>`<article class="product"><div class="product-img"><span class="tag">${p.category}</span>${p.image_url?`<img src="${p.image_url}" alt="">`:"🛍️"}</div><div class="product-info"><div class="product-cat">${p.category}</div><h3>${p.name}</h3><div class="rating">★★★★★</div><div class="price">${rupiah(p.price)}</div><button class="add" onclick="addToCart(${p.id})">+ Tambah ke Keranjang</button></div></article>`).join(""):'<div class="notice" style="grid-column:1/-1">Produk tidak ditemukan.</div>';
}
async function loadStore(){
  [products,categories]=await Promise.all([api("/api/products"),api("/api/categories")]);
  renderCategories();renderProducts();renderCart();
  try{const r=await api("/api/auth/me");me=r.user}catch{me=null}
  updateAuthUI();loadOrders();
}
function updateAuthUI(){
  $("#authBtn").textContent=me?`👋 ${me.name}`:"👤 Login";
  $("#userLabel").textContent=me&&me.role==="admin"?"Admin": "";
  if(me&&me.role==="admin") $("#authBtn").onclick=()=>location.href="/admin.html";
  else $("#authBtn").onclick=()=>openAuth("login");
}
function openAuth(mode="login"){authMode=mode;$("#authModal").classList.add("show");switchAuth(mode)}
function switchAuth(mode){
  authMode=mode;const login=mode==="login";
  $("#loginTab").classList.toggle("active",login);$("#registerTab").classList.toggle("active",!login);
  $("#nameGroup").style.display=login?"none":"block";$("#name").required=!login;
  $("#authTitle").textContent=login?"Selamat Datang 👋":"Buat Akun Baru ✨";
  $("#authSub").textContent=login?"Login untuk melanjutkan belanja.":"Daftar gratis untuk mulai berbelanja.";
  $("#authSubmit").textContent=login?"Login":"Daftar";$("#formMsg").textContent="";
}
async function submitAuth(e){
  e.preventDefault();$("#formMsg").textContent="";
  try{
    const body={email:$("#email").value,password:$("#password").value};
    if(authMode==="register")Object.assign(body,{name:$("#name").value});
    const r=await api(`/api/auth/${authMode}`,{method:"POST",body:JSON.stringify(body)});
    me=r.user;$("#authModal").classList.remove("show");updateAuthUI();loadOrders();toast(authMode==="login"?"Login berhasil 🎉":"Akun berhasil dibuat 🎉");
  }catch(e){$("#formMsg").textContent=e.message;$("#formMsg").style.color="#e53935"}
}
async function logout(){await api("/api/auth/logout",{method:"POST"});me=null;updateAuthUI();loadOrders();toast("Kamu sudah logout.")}
function openCheckout(){
  if(!me){$("#cartDrawer").classList.remove("show");openAuth("login");toast("Silakan login terlebih dahulu.");return}
  if(!cart.length)return toast("Keranjang masih kosong.");
  const total=cart.reduce((s,x)=>s+(productById(x.product_id)?.price||0)*x.quantity,0);
  $("#checkoutSummary").innerHTML=`<b>Total pembayaran: ${rupiah(total)}</b><br><small>Pembayaran akan dibuka melalui Midtrans setelah pesanan dibuat.</small>`;
  $("#checkoutModal").classList.add("show");$("#cartDrawer").classList.remove("show");
  $("#cName").value=me.name;
}
async function checkout(e){
  e.preventDefault();$("#checkoutMsg").textContent="";
  try{
    const body={customer_name:$("#cName").value,phone:$("#cPhone").value,address:$("#cAddress").value,city:$("#cCity").value,postal_code:$("#cPostal").value,items:cart};
    const order=await api("/api/orders",{method:"POST",body:JSON.stringify(body)});
    cart=[];saveCart();$("#checkoutModal").classList.remove("show");loadOrders();
    if(!order.payment_ready){toast("Pesanan dibuat, tetapi Midtrans belum dikonfigurasi.");return}
    const pay=await api("/api/payments/midtrans/token",{method:"POST",body:JSON.stringify({order_id:order.order_id})});
    await loadMidtrans(pay.client_key);
    window.snap.pay(pay.token,{
      onSuccess:()=>{toast("Pembayaran berhasil 🎉");loadOrders()},
      onPending:()=>{toast("Pembayaran menunggu konfirmasi.");loadOrders()},
      onError:()=>{toast("Pembayaran gagal.")},
      onClose:()=>{toast("Jendela pembayaran ditutup.")}
    });
  }catch(e){$("#checkoutMsg").textContent=e.message;$("#checkoutMsg").style.color="#e53935"}
}
function loadMidtrans(clientKey){
  return new Promise((resolve,reject)=>{
    if(window.snap)return resolve();
    const s=document.createElement("script");
    s.src=(location.hostname==="localhost"||location.hostname==="127.0.0.1")?"https://app.sandbox.midtrans.com/snap/snap.js":"https://app.sandbox.midtrans.com/snap/snap.js";
    s.setAttribute("data-client-key",clientKey);s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
  });
}
async function loadOrders(){
  if(!me){$("#orders").innerHTML='<div class="notice">Login untuk melihat pesanan.</div>';return}
  try{
    const orders=await api("/api/orders");
    $("#orders").innerHTML=orders.length?orders.map(o=>`<div class="order-card"><div class="order-head"><b>${o.order_code}</b><span class="status">${o.payment_status} · ${o.status}</span></div><div style="font-size:11px;color:#718096;margin-top:5px">${o.created_at}</div><div class="order-items">${o.items.map(i=>`${i.product_name} × ${i.quantity} = ${rupiah(i.price*i.quantity)}`).join("<br>")}</div><div class="order-total">${rupiah(o.total)}</div></div>`).join(""):'<div class="notice">Belum ada pesanan.</div>';
  }catch(e){$("#orders").innerHTML=`<div class="notice">${e.message}</div>`}
}

$("#loginTab").onclick=()=>switchAuth("login");$("#registerTab").onclick=()=>switchAuth("register");
$("#authForm").onsubmit=submitAuth;$("#checkoutForm").onsubmit=checkout;
$("#cartBtn").onclick=()=>{$("#cartDrawer").classList.add("show");renderCart()};
$("#search").oninput=renderProducts;
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.remove("show"));
loadStore();
