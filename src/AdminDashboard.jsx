import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase';
import { sendTrackingUpdate } from './emailNotifications';
import { Package, ShoppingCart, Users, IndianRupee, LogOut, RefreshCw, Save, Trash2, ExternalLink, ImagePlus, Search, Pencil, X, Mail, Truck, CheckCircle2 } from 'lucide-react';

const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));
const statuses = ['PAYMENT_PENDING', 'PAYMENT_FAILED', 'PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
const categories = ['Educational Toys', 'Soft Toys', 'RC Toys', 'Outdoor Toys'];
const blankProduct = { name: '', category: 'Educational Toys', description: '', price: '', offer_price: '', stock_quantity: '1', image_url: '', is_active: true };
const card = { background: '#fff', border: '1px solid #eee7ef', borderRadius: 17, padding: 18, boxShadow: '0 8px 24px #382a3908' };
const input = { width: '100%', padding: '11px 12px', border: '1px solid #e7dfe8', borderRadius: 10, background: '#fff', color: '#333247', boxSizing: 'border-box', marginTop: 5, font: 'inherit' };
const button = { border: 0, borderRadius: 10, padding: '11px 14px', fontWeight: 800, cursor: 'pointer', font: 'inherit' };

export default function AdminDashboard() {
  const [session, setSession] = useState(null), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [admin, setAdmin] = useState(false), [message, setMessage] = useState(''), [newPassword, setNewPassword] = useState('');
  const [tab, setTab] = useState('overview'), [products, setProducts] = useState([]), [orders, setOrders] = useState([]);
  const [product, setProduct] = useState(blankProduct), [editing, setEditing] = useState(null), [imageFile, setImageFile] = useState(null), [saving, setSaving] = useState(false), [filter, setFilter] = useState('');
  const notify = text => { setMessage(text); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setMessage(''), 5500); };

  const load = useCallback(async () => {
    if (!supabaseConfigured) return;
    setBusy(true);
    const [p, o] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false })
    ]);
    if (p.error) notify(`Products: ${p.error.message}`); else setProducts(p.data || []);
    if (o.error) notify(`Orders: ${o.error.message}`); else setOrders(o.data || []);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!session?.user) { setAdmin(false); return; }
      const { data, error } = await supabase.rpc('is_softies_admin');
      if (!active) return;
      if (error) { setAdmin(false); notify(`Admin role check failed: ${error.message}. Run the complete Supabase setup SQL.`); }
      else if (data === true) { setAdmin(true); load(); }
      else { setAdmin(false); notify('This account is not registered as the SOFTIES administrator.'); }
    })();
    return () => { active = false; };
  }, [session?.user?.id, load]);

  const signIn = async e => {
    e.preventDefault();
    if (!supabaseConfigured) return notify('Supabase is not connected. Set the environment values and redeploy.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return notify(error.message);
    setSession(data.session); setPassword('');
  };
  const googleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/admin` } });
    if (error) notify(error.message);
  };
  const resetPassword = async () => {
    if (!email) return notify('Enter your admin email first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin` });
    notify(error ? error.message : 'Password reset email requested. Check your inbox and spam folder.');
  };
  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setAdmin(false); };

  const saveProduct = async e => {
    e.preventDefault();
    if (!admin) return;
    if (!product.name.trim() || Number(product.price) <= 0 || !Number.isInteger(Number(product.stock_quantity)) || Number(product.stock_quantity) < 0) return notify('Enter a product name, valid price and stock quantity.');
    if (product.offer_price && (Number(product.offer_price) <= 0 || Number(product.offer_price) >= Number(product.price))) return notify('Offer price must be lower than the regular price.');
    if (!editing && !imageFile && !product.image_url) return notify('Upload a real photo of this product before adding it to the shop.');
    if (imageFile && (!imageFile.type.startsWith('image/') || imageFile.size > 5 * 1024 * 1024)) return notify('Choose an image under 5 MB (JPG, PNG, WEBP or AVIF).');
    setSaving(true);
    try {
      let image_url = product.image_url || null;
      if (imageFile) {
        const ext = (imageFile.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `products/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: false, contentType: imageFile.type });
        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}. Confirm that the product-images bucket and storage policies are created.`);
        image_url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        name: product.name.trim(), category: product.category, description: product.description.trim() || null,
        price: Number(product.price), offer_price: product.offer_price === '' ? null : Number(product.offer_price),
        stock_quantity: Number(product.stock_quantity), image_url, is_active: Boolean(product.is_active), updated_at: new Date().toISOString()
      };
      const result = editing
        ? await supabase.from('products').update(payload).eq('id', editing).select().single()
        : await supabase.from('products').insert(payload).select().single();
      if (result.error) throw result.error;
      notify(editing ? 'Product updated successfully.' : 'Product added successfully.');
      setProduct(blankProduct); setEditing(null); setImageFile(null); await load();
    } catch (err) { notify(err.message || 'Could not save product.'); }
    finally { setSaving(false); }
  };

  const editProduct = p => {
    setEditing(p.id);
    setProduct({ name: p.name || '', category: p.category || categories[0], description: p.description || '', price: String(p.price ?? ''), offer_price: p.offer_price == null ? '' : String(p.offer_price), stock_quantity: String(p.stock_quantity ?? 0), image_url: p.image_url || '', is_active: p.is_active !== false });
    setImageFile(null); setTab('products'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const hideProduct = async p => {
    if (!window.confirm(`Hide ${p.name} from the shop? You can make it visible again by editing it.`)) return;
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', p.id);
    if (error) notify(error.message); else { notify('Product hidden from the customer shop.'); load(); }
  };
  const updateOrder = async (order, patch) => {
    const { error } = await supabase.from('orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', order.id);
    if (error) return notify(error.message);
    const changed = ['order_status', 'tracking_id', 'tracking_notes'].some(k => String(order[k] ?? '') !== String(patch[k] ?? ''));
    if (changed) {
      const nextOrder = { ...order, ...patch, customer_email: order.email };
      try {
        const mail = await sendTrackingUpdate(nextOrder);
        if (mail.sent) notify('Order saved and tracking email sent.');
        else notify('Order saved. Tracking email not sent—check the EmailJS settings in Netlify.');
      } catch (err) { console.error('EmailJS tracking notification:', err); notify('Order saved, but EmailJS could not send the tracking email.'); }
      const { error: timelineError } = await supabase.from('tracking_updates').insert({ order_id: order.id, status: patch.order_status, message: patch.tracking_notes || null, tracking_number: patch.tracking_id || null, created_at: new Date().toISOString() });
      if (timelineError) console.warn('Could not add tracking timeline entry:', timelineError.message);
    } else notify('Customer details saved.');
    load();
  };

  const customers = useMemo(() => new Set(orders.map(o => o.email).filter(Boolean)).size, [orders]);
  const revenue = useMemo(() => orders.filter(o => o.payment_status === 'PAID' || o.payment_method === 'COD').reduce((sum, o) => sum + Number(o.total_amount || 0), 0), [orders]);
  const visibleProducts = products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(filter.toLowerCase()));
  const visibleOrders = orders.filter(o => `${o.id} ${o.email} ${o.customer_name} ${o.tracking_id || ''}`.toLowerCase().includes(filter.toLowerCase()));

  if (!supabaseConfigured) return <PageShell><div style={{ ...card, maxWidth: 650, margin: '10vh auto' }}><h1>SOFTIES Admin</h1><p>Connect Supabase by adding <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your Netlify environment variables.</p><a href="/">← Customer store</a></div></PageShell>;
  if (!session) return <PageShell><form onSubmit={signIn} style={{ ...card, width: 'min(430px, calc(100% - 40px))', margin: '8vh auto', boxSizing: 'border-box' }}><div style={{ fontSize: 12, letterSpacing: 2, color: '#e8798e', fontWeight: 900 }}>SOFTIES · PRIVATE AREA</div><h1 style={{ margin: '8px 0' }}>Admin sign in</h1><p style={{ color: '#777' }}>Only the administrator added in the Supabase app_admins table can open this dashboard.</p><button type="button" onClick={googleSignIn} style={{ ...button, ...input, background: '#fff' }}>Continue with Google</button><p style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>or use email and password</p><label style={labelStyle}>Email<input style={input} type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label style={labelStyle}>Password<input style={input} type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button style={{ ...button, ...input, background: '#ff7896', color: '#fff', marginTop: 18 }}>Sign in to dashboard</button><button type="button" onClick={resetPassword} style={{ display: 'block', margin: '12px auto', border: 0, color: '#d65e80', background: 'transparent', cursor: 'pointer' }}>Forgot password?</button>{message && <p role="status">{message}</p>}<a href="/">← Back to customer store</a></form></PageShell>;
  if (session && window.location.hash.includes('type=recovery')) return <PageShell><form onSubmit={async e => { e.preventDefault(); const { error } = await supabase.auth.updateUser({ password: newPassword }); if (error) notify(error.message); else { window.history.replaceState({}, document.title, window.location.pathname); setNewPassword(''); notify('Admin password updated successfully.'); } }} style={{ ...card, maxWidth: 430, margin: '9vh auto' }}><h1>Set a new admin password</h1><label style={labelStyle}>New password<input style={input} type="password" minLength="8" required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><button style={{ ...button, ...input, background: '#ff7896', color: '#fff', border: 0 }}>Update password</button>{message && <p role="status">{message}</p>}</form></PageShell>;
  if (!admin) return <PageShell><div style={{ ...card, maxWidth: 650, margin: '8vh auto' }}><h1>Admin access not enabled</h1><p>{message || 'This account is not registered as the SOFTIES administrator.'}</p><p>Open the setup guide, copy your user UUID from Supabase Authentication → Users, and add it to public.app_admins.</p><button onClick={signOut} style={button}>Sign out</button> <a href="/">Customer store</a></div></PageShell>;

  const nav = [['overview', 'Overview', IndianRupee], ['products', 'Products', Package], ['orders', 'Orders & tracking', ShoppingCart]];
  return <PageShell>
    <header style={{ padding: '18px 4vw', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><div><div style={{ fontSize: 11, letterSpacing: 2, color: '#e8798e', fontWeight: 900 }}>SOFTIES · ADMIN CONSOLE</div><h1 style={{ margin: '4px 0', fontSize: 25 }}>Store dashboard</h1><small>{session.user.email}</small></div><div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}><a href="/" style={{ ...button, display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff0f4', color: '#333247', textDecoration: 'none' }}>Customer store <ExternalLink size={14} /></a><button onClick={load} style={{ ...button, background: '#fff', border: '1px solid #eee' }}><RefreshCw size={15} /></button><button onClick={signOut} style={{ ...button, background: '#34344a', color: '#fff' }}><LogOut size={15} /> Sign out</button></div></header>
    <div style={{ display: 'flex', gap: 8, padding: '18px 4vw', flexWrap: 'wrap' }}>{nav.map(([id, title, Icon]) => <button key={id} onClick={() => { setTab(id); setFilter(''); }} style={{ ...button, display: 'flex', alignItems: 'center', gap: 8, background: tab === id ? '#34344a' : '#fff', color: tab === id ? '#fff' : '#555' }}><Icon size={17} />{title}</button>)}</div>
    <main style={{ padding: '0 4vw 50px', maxWidth: 1450, margin: 'auto' }}>
      {message && <div role="status" style={{ ...card, marginBottom: 15, borderColor: '#ffc5d2' }}>{message}</div>}
      {busy && <p style={{ color: '#777' }}>Refreshing store data…</p>}
      {tab === 'overview' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 20 }}>
          {[[Package, 'Products', products.length], [ShoppingCart, 'Orders', orders.length], [Users, 'Customers', customers], [IndianRupee, 'Order value', money(revenue)]].map(([Icon, title, value]) => <div key={title} style={card}><Icon color="#ed7890" /><div style={{ color: '#888', fontSize: 13, marginTop: 10 }}>{title}</div><strong style={{ fontSize: 27 }}>{value}</strong></div>)}
        </div>
        <div style={card}><h2 style={{ marginTop: 0 }}>Latest orders</h2>{orders.slice(0, 8).map(o => <div key={o.id} style={{ padding: '13px 0', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><span><b>Order #{o.id}</b> · {o.email}<small style={{ display: 'block', color: '#888' }}>{new Date(o.created_at).toLocaleString('en-IN')}</small></span><span>{money(o.total_amount)} · <b>{o.order_status}</b></span></div>)}{!orders.length && <p>No orders yet. Customer orders will appear here after checkout.</p>}</div>
      </>}
      {tab === 'products' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 18, alignItems: 'start' }}>
          <form onSubmit={saveProduct} style={card}>
            <h2 style={{ marginTop: 0 }}>{editing ? 'Edit product' : 'Add a new product'}</h2>
            <label style={labelStyle}>Product name<input style={input} required value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} placeholder="Example: Rainbow Building Blocks" /></label>
            <label style={labelStyle}>Category<select style={input} value={product.category} onChange={e => setProduct({ ...product, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
            <label style={labelStyle}>Description<textarea style={{ ...input, minHeight: 82, resize: 'vertical' }} value={product.description} onChange={e => setProduct({ ...product, description: e.target.value })} placeholder="Describe the toy, materials, recommended age and play benefits." /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label style={labelStyle}>Regular price (₹)<input style={input} type="number" min="1" step="0.01" required value={product.price} onChange={e => setProduct({ ...product, price: e.target.value })} /></label><label style={labelStyle}>Offer price (₹)<input style={input} type="number" min="0" step="0.01" value={product.offer_price} onChange={e => setProduct({ ...product, offer_price: e.target.value })} placeholder="Optional" /></label></div>
            <label style={labelStyle}>Available stock<input style={input} type="number" min="0" step="1" required value={product.stock_quantity} onChange={e => setProduct({ ...product, stock_quantity: e.target.value })} /></label>
            <label style={{ ...labelStyle, display: 'block', marginTop: 14 }}>Real product photo<input style={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => setImageFile(e.target.files?.[0] || null)} /></label>
            <small style={{ display: 'block', color: '#777', marginTop: 5 }}>Use a clear photo of the actual toy. Maximum 5 MB. JPG, PNG, WEBP or AVIF.</small>
            {(imageFile || product.image_url) && <img src={imageFile ? URL.createObjectURL(imageFile) : product.image_url} alt="Product preview" style={{ display: 'block', width: 160, height: 130, objectFit: 'contain', marginTop: 12, borderRadius: 12, background: '#fff7f8', border: '1px solid #eee' }} />}
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 15 }}><input type="checkbox" checked={product.is_active} onChange={e => setProduct({ ...product, is_active: e.target.checked })} /> Show product in customer shop</label>
            <button disabled={saving} style={{ ...button, marginTop: 16, width: '100%', background: '#ff7896', color: '#fff', opacity: saving ? .65 : 1 }}><Save size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{saving ? 'Saving…' : editing ? 'Save product changes' : 'Add product'}</button>
            {editing && <button type="button" onClick={() => { setProduct(blankProduct); setEditing(null); setImageFile(null); }} style={{ ...button, width: '100%', marginTop: 8, background: '#f4f0f4' }}>Cancel edit</button>}
          </form>
          <section style={card}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><h2 style={{ margin: 0 }}>Product catalogue ({products.length})</h2><span style={{ color: '#777', fontSize: 12 }}>Edit photos, price and stock</span></div><label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0' }}><Search size={16} /><input style={{ ...input, marginTop: 0 }} placeholder="Search products" value={filter} onChange={e => setFilter(e.target.value)} /></label>
            {visibleProducts.map(p => <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 0', borderTop: '1px solid #eee' }}>{p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: 65, height: 65, objectFit: 'contain', borderRadius: 10, background: '#fff7f8' }} /> : <div style={{ width: 65, height: 65, display: 'grid', placeItems: 'center', background: '#fff7f8', borderRadius: 10 }}><ImagePlus color="#c58a9a" /></div>}<div style={{ flex: 1, minWidth: 0 }}><b>{p.name}</b><small style={{ display: 'block', color: '#888' }}>{p.category} · {money(p.offer_price || p.price)} · stock {p.stock_quantity} · {p.is_active ? 'Visible' : 'Hidden'}</small></div><button title="Edit product" onClick={() => editProduct(p)} style={{ ...button, padding: 9, background: '#f3f0ff' }}><Pencil size={15} /></button><button title="Hide product" onClick={() => hideProduct(p)} style={{ ...button, padding: 9, background: '#fff0f4', color: '#c44' }}><Trash2 size={15} /></button></div>)}
            {!visibleProducts.length && <p style={{ color: '#777' }}>No products found. Add the actual products and upload their photos.</p>}
          </section>
        </div>
      </>}
      {tab === 'orders' && <section style={{ display: 'grid', gap: 14 }}><div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}><Search size={16} /><input style={{ ...input, marginTop: 0 }} placeholder="Search order ID, customer email, name or tracking ID" value={filter} onChange={e => setFilter(e.target.value)} /></div>{visibleOrders.map(o => <OrderEditor key={o.id} order={o} updateOrder={updateOrder} />)}{!visibleOrders.length && <div style={card}>No matching orders.</div>}</section>}
    </main>
  </PageShell>;
}

function OrderEditor({ order, updateOrder }) {
  const [status, setStatus] = useState(order.order_status || 'PLACED');
  const [tracking, setTracking] = useState(order.tracking_id || '');
  const [note, setNote] = useState(order.tracking_notes || '');
  const [customerName, setCustomerName] = useState(order.customer_name || '');
  const [phone, setPhone] = useState(order.phone || '');
  const [address, setAddress] = useState(order.address || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setStatus(order.order_status || 'PLACED'); setTracking(order.tracking_id || ''); setNote(order.tracking_notes || ''); setCustomerName(order.customer_name || ''); setPhone(order.phone || ''); setAddress(order.address || ''); }, [order]);
  const save = async () => { setSaving(true); await updateOrder(order, { customer_name: customerName.trim(), phone: phone.trim(), address: address.trim(), order_status: status, tracking_id: tracking.trim() || null, tracking_notes: note.trim() || null }); setSaving(false); };
  return <div style={card}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><b>Order #{order.id}</b><div style={{ fontSize: 13, color: '#777', marginTop: 5 }}><Mail size={13} style={{ verticalAlign: 'middle' }} /> {order.email} · {order.customer_name}</div><div style={{ marginTop: 7 }}><b>{money(order.total_amount)}</b> · Payment: {order.payment_method} / {order.payment_status}</div><small style={{ color: '#888' }}>{new Date(order.created_at).toLocaleString('en-IN')}</small></div><div style={{ background: '#fff0f4', color: '#b94d72', borderRadius: 20, padding: '7px 12px', height: 'fit-content', fontSize: 12, fontWeight: 800 }}>{order.order_status}</div></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(185px,1fr))', gap: 12, marginTop: 14 }}><label style={labelStyle}>Customer name<input style={input} value={customerName} onChange={e => setCustomerName(e.target.value)} /></label><label style={labelStyle}>Phone<input style={input} value={phone} onChange={e => setPhone(e.target.value)} /></label><label style={labelStyle}>Delivery address<input style={input} value={address} onChange={e => setAddress(e.target.value)} /></label><label style={labelStyle}>Order status<select style={input} value={status} onChange={e => setStatus(e.target.value)}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label><label style={labelStyle}>Tracking / courier ID<input style={input} value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Courier tracking number" /></label><label style={labelStyle}>Message to customer<input style={input} value={note} onChange={e => setNote(e.target.value)} placeholder="Your parcel has been shipped…" /></label></div>
    <button disabled={saving} onClick={save} style={{ ...button, marginTop: 13, background: '#34344a', color: '#fff' }}><Truck size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />{saving ? 'Saving…' : 'Save & email tracking update'}</button>
  </div>;
}

function PageShell({ children }) { return <div style={{ minHeight: '100vh', background: '#fff8f3', color: '#323247', fontFamily: 'system-ui, sans-serif' }}>{children}</div>; }
const labelStyle = { display: 'block', marginTop: 12, fontSize: 12, fontWeight: 800, color: '#454258' };
