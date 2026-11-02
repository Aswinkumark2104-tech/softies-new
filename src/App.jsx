import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ShoppingBag, Heart, Menu, X, Star, ArrowRight, Sparkles,
  Truck, ShieldCheck, Gift, Plus, Minus, Trash2, UserRound, SlidersHorizontal,
  PackageCheck, Mail, Instagram, Facebook, CircleHelp
} from 'lucide-react';
import { supabase, supabaseConfigured } from './supabase';
import { sendOrderConfirmation } from './emailNotifications';

const seedProducts = [
  { id:'p1', name:'Rainbow Learning Blocks', category:'Educational Toys', price:649, old_price:799, rating:4.9, age:'3–6 years', emoji:'🧱', color:'#fff0bd', badge:'BESTSELLER', description:'Bright, chunky blocks for building, sorting and creative play.', stock:24 },
  { id:'p2', name:'Cuddle Cloud Teddy', category:'Soft Toys', price:499, old_price:599, rating:4.8, age:'All ages', emoji:'🧸', color:'#ffe0e8', badge:'SOFT & CUDDLY', description:'A soft companion for story time, naps and everyday adventures.', stock:18 },
  { id:'p3', name:'Zoomster RC Racer', category:'RC Toys', price:1199, old_price:1499, rating:4.7, age:'6–10 years', emoji:'🏎️', color:'#dceaff', badge:'TOP PICK', description:'A colourful remote-control racer for indoor and outdoor fun.', stock:12 },
  { id:'p4', name:'Little Artist Kit', category:'Educational Toys', price:399, old_price:null, rating:4.8, age:'4–8 years', emoji:'🎨', color:'#e4f6d8', badge:'CREATIVE PLAY', description:'An imaginative art set for making colourful little masterpieces.', stock:32 },
  { id:'p5', name:'Dino Explorer Buddy', category:'Soft Toys', price:549, old_price:649, rating:4.9, age:'3–7 years', emoji:'🦕', color:'#d8f5e5', badge:'NEW FRIEND', description:'A friendly plush dinosaur ready for pretend-play adventures.', stock:16 },
  { id:'p6', name:'Mini Builder STEM Set', category:'Educational Toys', price:899, old_price:999, rating:4.6, age:'7–12 years', emoji:'⚙️', color:'#e9e0ff', badge:'LEARN & BUILD', description:'A hands-on construction set that encourages problem-solving.', stock:10 },
  { id:'p7', name:'Happy Hop Ball', category:'Outdoor Toys', price:349, old_price:null, rating:4.5, age:'4–8 years', emoji:'⚽', color:'#ffedcf', badge:'PLAY OUTSIDE', description:'A bright play ball for active games and outdoor fun.', stock:27 },
  { id:'p8', name:'Rocket Adventure Set', category:'RC Toys', price:799, old_price:999, rating:4.7, age:'5–9 years', emoji:'🚀', color:'#dff5ff', badge:'SPACE FUN', description:'Launch imaginative space missions with this playful rocket set.', stock:14 },
];

const categories = [
  { name:'Educational Toys', emoji:'🧠', color:'#fff0bd', subtitle:'Play, learn & discover' },
  { name:'Soft Toys', emoji:'🧸', color:'#ffe0e8', subtitle:'Cuddles and comfort' },
  { name:'RC Toys', emoji:'🚗', color:'#dceaff', subtitle:'Ready, set, zoom!' },
  { name:'Outdoor Toys', emoji:'⚽', color:'#e4f6d8', subtitle:'Big fun outdoors' },
];

const money = n => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(n);

function App() {
  const [products, setProducts] = useState(seedProducts);
  const [category, setCategory] = useState('All Toys');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('softies-cart') || '[]'));
  const [wishlist, setWishlist] = useState(() => JSON.parse(localStorage.getItem('softies-wishlist') || '[]'));
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [quizOpen, setQuizOpen] = useState(false);
  const [age, setAge] = useState('Any age');
  const [budget, setBudget] = useState('Any budget');
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin';
  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
  const [adminMode, setAdminMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('Educational Toys');
  const [orderBusy, setOrderBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutDetails, setCheckoutDetails] = useState({ customer_name:'', phone:'', address:'', area:'', city:'', state:'Tamil Nadu', pincode:'', payment_method:'COD' });
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef(null);
  const holdStart = useRef(null);
  const holdComplete = useRef(false);

  useEffect(() => localStorage.setItem('softies-cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('softies-wishlist', JSON.stringify(wishlist)), [wishlist]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (alive) setUser(session?.user || null);
      const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
      return () => data.subscription.unsubscribe();
    })();
    (async () => {
      const { data, error } = await supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending:false });
      if (!error && data?.length) setProducts(data.map(p => ({...p, emoji:p.emoji || '🧸', color:p.color || '#fff0bd', rating:p.rating || 4.8})));
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!isAdminRoute) return;
    if (!user) {
      setAuthOpen(true);
      setAdminMode(false);
      return;
    }
    setAuthOpen(false);
    if (!adminEmail) {
      setAdminMode(false);
      setNotice('Admin access is not configured yet. Add VITE_ADMIN_EMAIL to your .env file.');
      return;
    }
    if (user.email?.toLowerCase() === adminEmail) {
      setAdminMode(true);
    } else {
      setAdminMode(false);
      setNotice('Access denied: this account is not configured as the SOFTIES admin.');
    }
  }, [isAdminRoute, user, adminEmail]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => {
    let list = products.filter(p => (category === 'All Toys' || p.category === category) &&
      `${p.name} ${p.category} ${p.description || ''}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === 'low') list = [...list].sort((a,b) => a.price-b.price);
    if (sort === 'high') list = [...list].sort((a,b) => b.price-a.price);
    if (sort === 'new') list = [...list].reverse();
    return list;
  }, [products, category, query, sort]);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const recommended = products.filter(p => (age === 'Any age' || p.age === age || p.age === 'All ages') && (budget === 'Any budget' || p.price <= Number(budget)));
  const addToCart = p => {
    setCart(old => {
      const existing = old.find(i => i.id === p.id);
      return existing ? old.map(i => i.id === p.id ? {...i, qty:i.qty+1} : i) : [...old, {...p, qty:1}];
    });
    setNotice(`${p.name} added to your bag!`);
  };
  const updateQty = (id, delta) => setCart(old => old.map(i => i.id === id ? {...i, qty:i.qty+delta} : i).filter(i => i.qty > 0));
  const toggleWish = p => setWishlist(old => {
    const next = old.includes(p.id) ? old.filter(id => id !== p.id) : [...old, p.id];
    setNotice(next.includes(p.id) ? 'Saved to your wishlist 💖' : 'Removed from wishlist');
    return next;
  });
  const scrollShop = () => document.getElementById('shop')?.scrollIntoView({behavior:'smooth'});

  const googleSignIn = async () => { if (!supabaseConfigured) return setNotice('Connect Supabase first — see SETUP.md'); const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}}); if(error)setNotice(error.message); };
  const signIn = async e => {
    e.preventDefault();
    if (!supabaseConfigured) return setNotice('Connect Supabase first — see SETUP.md');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setNotice(error.message);
    setUser(data.user); setAuthOpen(false); setPassword(''); setNotice('Welcome back!');
  };
  const signUp = async () => {
    if (!supabaseConfigured) return setNotice('Connect Supabase first — see SETUP.md');
    if (!email || password.length < 8) return setNotice('Enter an email and a password of at least 8 characters.');
    const { error } = await supabase.auth.signUp({ email, password });
    setNotice(error ? error.message : 'Check your email to confirm your account.');
  };
  const signOut = async () => {
    if (supabaseConfigured) await supabase.auth.signOut();
    setUser(null); setAdminMode(false); setNotice('You have signed out.');
  };

  const checkout = () => {
    if (!cart.length) return;
    if (!user) { setCartOpen(false); setAuthOpen(true); setNotice('Sign in before continuing to checkout.'); return; }
    setCheckoutDetails(old => ({...old, customer_name:old.customer_name || user.user_metadata?.full_name || user.user_metadata?.name || '', phone:old.phone || user.user_metadata?.phone || ''}));
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const placeOrder = async () => {
    if (orderBusy || !cart.length) return;
    const d = checkoutDetails;
    if (!d.customer_name.trim() || !d.phone.trim() || !d.address.trim() || !d.area.trim() || !d.city.trim() || !d.state.trim() || !/^\d{6}$/.test(d.pincode.trim())) {
      setNotice('Please complete all delivery details and enter a valid 6-digit PIN code.');
      setHoldProgress(0);
      return;
    }
    if (d.payment_method !== 'COD') {
      setNotice('Online payment is not activated yet. Please choose Cash on Delivery (COD).');
      setHoldProgress(0);
      return;
    }
    setOrderBusy(true);
    try {
      if (!supabaseConfigured) throw new Error('Connect Supabase before placing real orders.');
      const fullAddress = `${d.address.trim()}, ${d.area.trim()}, ${d.city.trim()}, ${d.state.trim()} - ${d.pincode.trim()}`;
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        user_id:user.id, email:user.email, customer_name:d.customer_name.trim(), phone:d.phone.trim(),
        address:fullAddress, city:d.city.trim(), state:d.state.trim(), pincode:d.pincode.trim(),
        total_amount:total, payment_method:'COD', payment_status:'PENDING', order_status:'PLACED'
      }).select().single();
      if (orderError) throw orderError;
      const tracking_id = `SOF-${String(order.id).padStart(6, '0')}`;
      const { error: trackingError } = await supabase.from('orders').update({tracking_id}).eq('id', order.id);
      if (trackingError) throw trackingError;
      const rows = cart.map(i => ({ order_id:order.id, product_id:(typeof i.id==='string' && /^[0-9a-f-]{36}$/i.test(i.id))?i.id:null, product_name:i.name, unit_price:i.price, quantity:i.qty }));
      const { error: itemsError } = await supabase.from('order_items').insert(rows);
      if (itemsError) throw itemsError;
      const confirmedOrder = {...order, tracking_id, email:user.email, customer_name:d.customer_name.trim(), phone:d.phone.trim(), address:fullAddress};
      let orderEmailSent = false;
      try { const mailResult = await sendOrderConfirmation(confirmedOrder); orderEmailSent = Boolean(mailResult?.sent); } catch (mailError) { console.error('SOFTIES order confirmation email failed:', mailError); }
      if (window.gtag) window.gtag('event','purchase',{transaction_id:String(order.id),value:total,currency:'INR',payment_type:'COD',items:cart.map(i=>({item_name:i.name,price:i.price,quantity:i.qty}))});
      setCart([]); setCheckoutOpen(false); setHoldProgress(0);
      setNotice(`Order ${String(order.id).slice(0,8)} placed! Tracking ID ${tracking_id}. ${orderEmailSent ? 'Confirmation email sent.' : 'Email not configured yet; see SETUP.md.'} Track it in My Account.`);
    } catch (err) { setNotice(err.message || 'Could not create order.'); }
    finally { setOrderBusy(false); setHoldProgress(0); }
  };

  const startHoldConfirm = e => {
    e.preventDefault();
    if (orderBusy) return;
    holdComplete.current = false;
    holdStart.current = Date.now();
    setHoldProgress(0);
    const tick = () => {
      const elapsed = Date.now() - holdStart.current;
      const progress = Math.min(100, (elapsed / 2000) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        holdComplete.current = true;
        clearInterval(holdTimer.current);
        holdTimer.current = null;
        placeOrder();
      }
    };
    holdTimer.current = setInterval(tick, 35);
  };
  const stopHoldConfirm = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    if (!holdComplete.current && holdProgress < 100) setHoldProgress(0);
  };

  const addProduct = async e => {
    e.preventDefault();
    if (!user || !adminEmail || user.email?.toLowerCase() !== adminEmail) return setNotice('Admin access required.');
    if (!newName.trim() || Number(newPrice) <= 0) return setNotice('Enter a product name and valid price.');
    const p = { name:newName.trim(), price:Number(newPrice), category:newCategory, description:'A lovely new toy from SOFTIES.', stock:10, stock_quantity:10, is_active:true, emoji:'🧸', color:'#fff0bd' };
    if (supabaseConfigured && user) {
      const { data, error } = await supabase.from('products').insert(p).select().single();
      if (error) return setNotice(error.message);
      setProducts(old => [data, ...old]);
    } else {
      setProducts(old => [{...p, id:`local-${Date.now()}`, rating:4.8}, ...old]);
      setNotice('Demo product added locally. Connect Supabase to save it permanently.');
    }
    setNewName(''); setNewPrice('');
  };

  const ProductCard = ({p}) => (
    <motion.article className="product-card" whileHover={{y:-7}} transition={{type:'spring', stiffness:260, damping:18}}>
      <div className="product-art" style={{background:p.color || '#fff0bd'}}>
        {p.badge && <span className="badge">{p.badge}</span>}
        <button className={`heart ${wishlist.includes(p.id) ? 'liked':''}`} onClick={() => toggleWish(p)} aria-label="Add to wishlist"><Heart size={19} fill={wishlist.includes(p.id) ? 'currentColor':'none'} /></button>
        {p.image_url ? <img className="product-photo" src={p.image_url} alt={p.name} loading="lazy"/> : <span className="toy-emoji" role="img" aria-label={p.name}>{p.emoji || '🧸'}</span>}
        <span className="art-sparkle sparkle-one">✦</span><span className="art-sparkle sparkle-two">✧</span>
      </div>
      <div className="product-info">
        <div className="product-category">{p.category}</div>
        <h3>{p.name}</h3>
        <div className="rating"><Star size={14} fill="currentColor" /> {p.rating || '4.8'} <span>({p.stock ?? 10} in stock)</span></div>
        <div className="price-row"><strong>{money(p.price)}</strong>{p.old_price && <del>{money(p.old_price)}</del>}</div>
        <button className="add-btn" onClick={() => addToCart(p)}><Plus size={17}/> Add to Bag</button>
      </div>
    </motion.article>
  );

  return <div className="app-shell">
    <div className="announcement"><Sparkles size={14}/> Little joys, big adventures! <span>Discover something wonderful today.</span> <Sparkles size={14}/></div>
    <header className="header">
      <button className="mobile-toggle icon-btn" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open menu">{mobileMenu?<X/>:<Menu/>}</button>
      <a className="brand" href="#" aria-label="SOFTIES Toy Store home" onClick={e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});}}><img className="brand-logo" src="/softies-logo.jpg" alt="SOFTIES Toy Store — Play. Learn. Grow. Together." /></a>
      <nav className={mobileMenu?'nav nav-open':'nav'}>
        <a href="#home" onClick={()=>setMobileMenu(false)}>Home</a>
        <a href="#categories" onClick={()=>setMobileMenu(false)}>Categories</a>
        <a href="#shop" onClick={()=>setMobileMenu(false)}>Shop All</a>
        <a href="#about" onClick={()=>setMobileMenu(false)}>Our Story</a>
      </nav>
      <div className="header-actions">
        <label className="search-box"><Search size={17}/><input value={query} onChange={e=>{setQuery(e.target.value);document.getElementById('shop')?.scrollIntoView({behavior:'smooth'});}} placeholder="Find a little joy..." /></label>
        <button className="icon-btn account-btn" onClick={()=>{window.location.href='/account';}} aria-label="My account and orders"><UserRound/></button>
        <button className="icon-btn cart-icon" onClick={()=>setCartOpen(true)} aria-label="Shopping bag"><ShoppingBag/><span>{cartCount}</span></button>
      </div>
    </header>

    <main>
      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span>✦</span> A LITTLE WORLD OF WONDER <span>✦</span></div>
          <h1>Little toys.<br/><em>BIG</em> imagination<span className="title-dot">!</span></h1>
          <p>From first discoveries to endless adventures, find toys that make every little moment magical.</p>
          <div className="hero-actions"><button className="primary-btn" onClick={scrollShop}>Explore Toys <ArrowRight size={18}/></button><button className="text-btn" onClick={()=>setQuizOpen(true)}>Help me choose <Sparkles size={16}/></button></div>
          <div className="hero-proof"><div className="avatar-stack"><span>🧒</span><span>👧</span><span>🧑</span></div><div><div className="proof-stars">★★★★★</div><small>Made for little moments of joy</small></div></div>
          <span className="hero-doodle doodle-star">✦</span><span className="hero-doodle doodle-heart">♡</span>
        </div>
        <div className="hero-visual">
          <div className="sun-disc"></div><span className="float-cloud cloud-a">☁</span><span className="float-cloud cloud-b">☁</span>
          <motion.div className="hero-toy teddy" animate={{y:[0,-12,0],rotate:[-3,2,-3]}} transition={{duration:4,repeat:Infinity,ease:'easeInOut'}}>🧸</motion.div>
          <motion.div className="hero-toy blocks" animate={{y:[0,8,0],rotate:[3,-2,3]}} transition={{duration:3.5,repeat:Infinity,ease:'easeInOut'}}>🧩</motion.div>
          <motion.div className="hero-toy rocket" animate={{y:[0,-8,0],x:[0,5,0]}} transition={{duration:3,repeat:Infinity,ease:'easeInOut'}}>🚀</motion.div>
          <div className="hero-sticker sticker-left">PLAY<br/><b>MORE!</b></div><div className="hero-sticker sticker-right">LOVE<br/>TO LEARN ♡</div>
          <div className="rainbow"></div><span className="hero-star star-a">✦</span><span className="hero-star star-b">✧</span><span className="hero-star star-c">✦</span>
        </div>
        <div className="hero-bottom-note"><span>☀</span> Curious minds. Happy hearts. Playful days.</div>
      </section>

      <section className="trust-strip">
        <div><ShieldCheck/><span><b>Thoughtfully Picked</b><small>Playtime favourites</small></span></div>
        <div><Truck/><span><b>Delivery to Your Door</b><small>Updates every step</small></span></div>
        <div><Gift/><span><b>Gifts Made Easy</b><small>For every little star</small></span></div>
        <div><Heart/><span><b>Made for Smiles</b><small>Joy in every box</small></span></div>
      </section>

      <section className="section categories-section" id="categories">
        <div className="section-heading"><div><span className="eyebrow">A WORLD TO EXPLORE</span><h2>What are we playing <em>today?</em></h2></div><button className="link-btn" onClick={()=>{setCategory('All Toys');scrollShop();}}>See all toys <ArrowRight size={16}/></button></div>
        <div className="category-grid">{categories.map((c,i)=><motion.button key={c.name} className="category-card" style={{'--cat':c.color}} onClick={()=>{setCategory(c.name);scrollShop();}} whileHover={{y:-5,rotate:i%2?1:-1}}><span className="category-emoji">{c.emoji}</span><span className="category-name">{c.name}</span><span className="category-sub">{c.subtitle}</span><span className="category-arrow"><ArrowRight size={17}/></span></motion.button>)}</div>
      </section>

      <section className="section shop-section" id="shop">
        <div className="section-heading"><div><span className="eyebrow">THE TOY BOX IS OPEN</span><h2>Little things, <em>big smiles.</em></h2><p className="section-sub">Handpicked favourites for curious little minds.</p></div><button className="toy-finder-btn" onClick={()=>setQuizOpen(true)}><Sparkles size={17}/> Find my toy</button></div>
        <div className="shop-toolbar"><div className="filter-tabs">{['All Toys',...categories.map(c=>c.name)].map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><label className="sort-select"><SlidersHorizontal size={16}/><select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="new">Newest first</option></select></label></div>
        {filtered.length ? <div className="product-grid">{filtered.map(p=><ProductCard key={p.id} p={p}/>)}</div> : <div className="empty-state"><span>🧸</span><h3>No toys found just yet</h3><p>Try another search or category.</p><button className="primary-btn" onClick={()=>{setQuery('');setCategory('All Toys');}}>Show all toys</button></div>}
        <div className="center-action"><button className="outline-btn" onClick={()=>{setCategory('All Toys');setQuery('');}}>Explore the whole toy box <ArrowRight size={17}/></button></div>
      </section>

      <section className="gift-banner">
        <div className="gift-art"><span className="gift-big">🎁</span><span className="gift-mini">✨</span><span className="gift-mini two">🎈</span></div>
        <div className="gift-copy"><span className="eyebrow">A LITTLE SOMETHING SPECIAL</span><h2>Big celebrations.<br/><em>Little surprises.</em></h2><p>Birthday magic, thoughtful gifts and bundles made for happy little faces.</p><button className="light-btn" onClick={()=>{setCategory('All Toys');scrollShop();}}>Find a gift <ArrowRight size={17}/></button></div>
        <div className="gift-pattern">✦　♡　✧　✿</div>
      </section>

      <section className="section why-section" id="about">
        <div className="why-intro"><span className="eyebrow">A LITTLE ABOUT US</span><h2>Growing through <em>play.</em></h2><p>We believe play is where big ideas begin. SOFTIES brings together joyful toys that invite children to imagine, build, create and explore.</p><button className="text-btn" onClick={()=>setNotice('Our story: helping little imaginations grow, one playful moment at a time.')}>Our little story <ArrowRight size={16}/></button></div>
        <div className="why-cards"><div className="why-card green"><span>🌱</span><h3>Room to Grow</h3><p>Ideas and skills grow through playful discovery.</p></div><div className="why-card pink"><span>💗</span><h3>Joy in Every Box</h3><p>Thoughtful picks for everyday fun and gifting.</p></div><div className="why-card yellow"><span>🌟</span><h3>Wonder Every Day</h3><p>Inspiring toys for curious little explorers.</p></div></div>
      </section>

      <section className="newsletter"><div className="newsletter-icon">💌</div><div><span className="eyebrow">A NOTE FROM THE TOY BOX</span><h2>Little updates, lots of joy.</h2><p>New toys, gift ideas and playful inspiration.</p></div><form onSubmit={e=>{e.preventDefault();setNotice('Thanks for your interest! Newsletter sign-up needs an email service connection.');}}><input type="email" required placeholder="Your email address"/><button className="primary-btn">Count me in <ArrowRight size={16}/></button></form></section>
    </main>

    <a className="floating-whatsapp" href="https://wa.me/919092096062?text=Hello%20SOFTIES%2C%20I%20would%20like%20to%20know%20about%20your%20toys." target="_blank" rel="noreferrer" aria-label="Chat with SOFTIES on WhatsApp"><span>☏</span><b>Chat with us</b></a>
    <footer className="footer"><div className="footer-main"><div className="footer-brand"><a className="brand footer-logo-link" href="#home" aria-label="SOFTIES Toy Store home"><img className="brand-logo footer-logo" src="/softies-logo.jpg" alt="SOFTIES Toy Store logo" /></a><p>Little toys, big imagination.<br/>Here's to more playful days.</p><div className="socials"><a href="https://www.instagram.com/softies__uz/" target="_blank" rel="noreferrer" aria-label="Visit SOFTIES on Instagram"><Instagram/></a><a href="https://wa.me/919092096062?text=Hello%20SOFTIES%2C%20I%20would%20like%20to%20know%20about%20your%20toys." target="_blank" rel="noreferrer" aria-label="Chat with SOFTIES on WhatsApp" className="whatsapp-social">WA</a><a href="mailto:hello@softies.example" aria-label="Email"><Mail/></a></div></div><div><h4>Let's Explore</h4><a href="#shop" onClick={()=>setCategory('All Toys')}>Shop all toys</a>{categories.map(c=><a key={c.name} href="#shop" onClick={()=>setCategory(c.name)}>{c.name}</a>)}</div><div><h4>Here to Help</h4><a href="#contact">Contact us</a><a href="#contact">Delivery information</a><a href="#contact">Returns & refunds</a><a href="#contact">FAQs</a><a href="/account">My account &amp; order tracking</a></div><div id="contact"><h4>Need a hand?</h4><p>Questions about a toy or an order?</p><a className="footer-help" href="mailto:hello@softies.example"><CircleHelp size={17}/> Get in touch</a><a className="footer-help whatsapp-help" href="https://wa.me/919092096062?text=Hello%20SOFTIES%2C%20I%20need%20help%20with%20a%20toy%20or%20order." target="_blank" rel="noreferrer">Chat on WhatsApp · 9092096062</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} SOFTIES. Growing through play.</span><span>Privacy · Terms · Returns</span><span>Made with a little ✦ magic</span></div></footer>

    <AnimatePresence>{notice && <motion.div className="toast" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}}><Sparkles size={17}/>{notice}</motion.div>}</AnimatePresence>

    <AnimatePresence>{cartOpen && <motion.div className="overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setCartOpen(false)}><motion.aside className="drawer" initial={{x:420}} animate={{x:0}} exit={{x:420}} onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">YOUR LITTLE FINDS</span><h2>Shopping bag <span>({cartCount})</span></h2></div><button className="icon-btn" onClick={()=>setCartOpen(false)}><X/></button></div>{!cart.length?<div className="empty-state"><span>🛍️</span><h3>Your bag is taking a nap</h3><p>Add a little joy to wake it up.</p><button className="primary-btn" onClick={()=>{setCartOpen(false);scrollShop();}}>Explore toys</button></div>:<><div className="cart-items">{cart.map(i=><div className="cart-item" key={i.id}><div className="cart-thumb" style={{background:i.color}}>{i.emoji}</div><div className="cart-item-info"><b>{i.name}</b><strong>{money(i.price)}</strong><div className="qty-control"><button onClick={()=>updateQty(i.id,-1)}><Minus size={13}/></button><span>{i.qty}</span><button onClick={()=>updateQty(i.id,1)}><Plus size={13}/></button></div></div><button className="remove-btn" onClick={()=>updateQty(i.id,-i.qty)} aria-label="Remove item"><Trash2 size={17}/></button></div>)}</div><div className="cart-summary"><div><span>Subtotal</span><b>{money(total)}</b></div><small>Delivery charges, if any, are calculated at checkout.</small><button className="primary-btn checkout-btn" onClick={checkout} disabled={orderBusy}>{orderBusy?'Creating order...':'Continue to checkout'} <ArrowRight size={17}/></button><p className="secure-note"><ShieldCheck size={15}/> Secure checkout after payment setup</p></div></>}</motion.aside></motion.div>}</AnimatePresence>

    <AnimatePresence>{checkoutOpen && <motion.div className="modal-backdrop checkout-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>{stopHoldConfirm();setCheckoutOpen(false);}}><motion.div className="modal checkout-modal" initial={{y:20,scale:.97}} animate={{y:0,scale:1}} exit={{y:20,scale:.97}} onClick={e=>e.stopPropagation()}><button className="modal-close icon-btn" onClick={()=>{stopHoldConfirm();setCheckoutOpen(false);}} aria-label="Close checkout"><X/></button><div className="modal-emoji">📦</div><span className="eyebrow">ALMOST YOURS</span><h2>Delivery details</h2><p className="checkout-intro">Tell us where to deliver your little bundle of joy.</p><form className="checkout-form" onSubmit={e=>e.preventDefault()}><div className="checkout-section-title">Customer details</div><label>Full name<input autoComplete="name" required value={checkoutDetails.customer_name} onChange={e=>setCheckoutDetails({...checkoutDetails,customer_name:e.target.value})} placeholder="Your full name"/></label><label>Email address<input type="email" value={user?.email || ''} readOnly autoComplete="email"/></label><label>Mobile number<input type="tel" required autoComplete="tel" inputMode="tel" value={checkoutDetails.phone} onChange={e=>setCheckoutDetails({...checkoutDetails,phone:e.target.value})} placeholder="10-digit mobile number"/></label><div className="checkout-section-title">Delivery address</div><label>House / Flat, street<input required autoComplete="address-line1" value={checkoutDetails.address} onChange={e=>setCheckoutDetails({...checkoutDetails,address:e.target.value})} placeholder="Door no. and street name"/></label><label>Area / Locality<input required autoComplete="address-line2" value={checkoutDetails.area} onChange={e=>setCheckoutDetails({...checkoutDetails,area:e.target.value})} placeholder="Area or locality"/></label><div className="checkout-fields-row"><label>City<input required autoComplete="address-level2" value={checkoutDetails.city} onChange={e=>setCheckoutDetails({...checkoutDetails,city:e.target.value})} placeholder="City"/></label><label>PIN code<input required autoComplete="postal-code" inputMode="numeric" maxLength="6" pattern="[0-9]{6}" value={checkoutDetails.pincode} onChange={e=>setCheckoutDetails({...checkoutDetails,pincode:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder="6 digits"/></label></div><label>State<input required autoComplete="address-level1" value={checkoutDetails.state} onChange={e=>setCheckoutDetails({...checkoutDetails,state:e.target.value})} placeholder="State"/></label><div className="checkout-section-title">Order summary</div><div className="checkout-order-items">{cart.map(i=><div key={i.id}><span>{i.emoji || '🧸'} {i.name} × {i.qty}</span><b>{money(i.price*i.qty)}</b></div>)}<div className="checkout-total"><span>Total</span><b>{money(total)}</b></div></div><div className="checkout-section-title">Payment method</div><label className="payment-choice"><input type="radio" name="payment" checked={checkoutDetails.payment_method==='COD'} onChange={()=>setCheckoutDetails({...checkoutDetails,payment_method:'COD'})}/> Cash on Delivery (COD)</label><label className="payment-choice payment-disabled"><input type="radio" name="payment" checked={checkoutDetails.payment_method==='RAZORPAY'} onChange={()=>setCheckoutDetails({...checkoutDetails,payment_method:'RAZORPAY'})}/> Online payment (Razorpay) <small>Not active yet</small></label><button type="button" className="hold-confirm-btn" style={{'--hold-progress':`${holdProgress}%`}} onPointerDown={startHoldConfirm} onPointerUp={stopHoldConfirm} onPointerLeave={stopHoldConfirm} onPointerCancel={stopHoldConfirm} onContextMenu={e=>e.preventDefault()} disabled={orderBusy}><span className="hold-progress-fill" style={{width:`${holdProgress}%`}}/><span className="hold-confirm-label">{orderBusy?'Placing your order…':holdProgress>0?'Keep holding to confirm':'Press and hold for 2 seconds to confirm order'}</span></button><p className="hold-hint"><ShieldCheck size={14}/> Please check your address and order total before confirming.</p></form></motion.div></motion.div>}</AnimatePresence>

    <AnimatePresence>{authOpen && <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setAuthOpen(false)}><motion.div className="modal" initial={{y:20,scale:.97}} animate={{y:0,scale:1}} exit={{y:20,scale:.97}} onClick={e=>e.stopPropagation()}><button className="modal-close icon-btn" onClick={()=>setAuthOpen(false)}><X/></button><div className="modal-emoji">👋</div><span className="eyebrow">WELCOME TO SOFTIES</span><h2>{user?'You are signed in!':'Come on in, explorer.'}</h2>{user?<><p>{user.email}</p><button className="primary-btn full-btn" onClick={signOut}>Sign out</button></>:<form onSubmit={signIn} className="auth-form"><button type="button" className="primary-btn full-btn" onClick={googleSignIn}>Continue with Google</button><p className="small-muted" style={{textAlign:'center'}}>or sign in with email</p><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength="8" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label><button className="primary-btn full-btn" type="submit">Sign in <ArrowRight size={16}/></button><button type="button" className="text-btn centered" onClick={signUp}>New here? Create an account</button></form>}<p className="small-muted">{supabaseConfigured?'Account services are connected.':'Demo mode: add Supabase credentials in your .env file to enable accounts.'}</p></motion.div></motion.div>}</AnimatePresence>

    <AnimatePresence>{quizOpen && <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setQuizOpen(false)}><motion.div className="modal quiz-modal" initial={{y:20,scale:.97}} animate={{y:0,scale:1}} exit={{y:20,scale:.97}} onClick={e=>e.stopPropagation()}><button className="modal-close icon-btn" onClick={()=>setQuizOpen(false)}><X/></button><div className="modal-emoji">🔎</div><span className="eyebrow">YOUR PERSONAL TOY HELPER</span><h2>Let's find their next favourite!</h2><label className="quiz-label">Age group<select value={age} onChange={e=>setAge(e.target.value)}><option>Any age</option><option>All ages</option><option>3–6 years</option><option>6–10 years</option><option>4–8 years</option><option>7–12 years</option><option>3–7 years</option><option>5–9 years</option></select></label><label className="quiz-label">Budget<select value={budget} onChange={e=>setBudget(e.target.value)}><option>Any budget</option><option value="500">Under ₹500</option><option value="800">Under ₹800</option><option value="1200">Under ₹1,200</option></select></label><div className="quiz-results"><b>Ideas for you</b><div>{recommended.slice(0,3).map(p=><button key={p.id} className="quiz-result" onClick={()=>{setQuizOpen(false);scrollShop();setCategory(p.category);}}><span style={{background:p.color}}>{p.emoji}</span><span>{p.name}<small>{money(p.price)}</small></span><ArrowRight size={15}/></button>)}</div>{!recommended.length && <p>No exact match. Try a higher budget or any age.</p>}</div><button className="primary-btn full-btn" onClick={()=>{setQuizOpen(false);scrollShop();}}>Browse recommendations <ArrowRight size={17}/></button></motion.div></motion.div>}</AnimatePresence>

    {adminMode && <div className="admin-panel"><div className="admin-head"><h2>🛠️ Quick Product Manager</h2><button className="icon-btn" onClick={()=>setAdminMode(false)}><X/></button></div><p className="small-muted">Admin view. Database-level admin permissions must also be configured securely in Supabase before product changes can be saved.</p><form className="admin-form" onSubmit={addProduct}><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Toy name" required/><input value={newPrice} onChange={e=>setNewPrice(e.target.value)} type="number" min="1" placeholder="Price in ₹" required/><select value={newCategory} onChange={e=>setNewCategory(e.target.value)}>{categories.map(c=><option key={c.name}>{c.name}</option>)}</select><button className="primary-btn">Add toy</button></form><div className="admin-product-list">{products.map(p=><div key={p.id}><span>{p.emoji} {p.name}</span><b>{money(p.price)}</b><button onClick={async()=>{if(supabaseConfigured && user && !String(p.id).startsWith('local-')){const {error}=await supabase.from('products').update({is_active:false}).eq('id',p.id);if(error)return setNotice(error.message);}setProducts(old=>old.filter(x=>x.id!==p.id));setNotice('Product removed from this view.');}}><Trash2 size={15}/></button></div>)}</div></div>}
    <button className="admin-shortcut" onClick={()=>{window.location.href='/admin';}} title="Admin dashboard">⚙</button>
  </div>;
}

export default App;
