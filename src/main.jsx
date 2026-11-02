import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import CustomerAccount from './CustomerAccount.jsx';
import './styles.css';
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const Page = path === '/admin' ? AdminDashboard : path === '/account' ? CustomerAccount : App;
createRoot(document.getElementById('root')).render(<React.StrictMode><Page /></React.StrictMode>);
