import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite HMR WebSocket connection errors in the sandbox environment
if (typeof window !== 'undefined') {
  const isViteWSWarning = (msg: string) => 
    msg.includes('WebSocket') || 
    msg.includes('vite') || 
    msg.includes('ws://') || 
    msg.includes('wss://');

  window.addEventListener('unhandledrejection', (event) => {
    const reasonMsg = event.reason?.message || String(event.reason || '');
    if (isViteWSWarning(reasonMsg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const errorMsg = event.message || '';
    if (isViteWSWarning(errorMsg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

// Domain guard to deactivate app on the preview/pre-render domain and force Vercel usage
const isBlockedDomain = typeof window !== 'undefined' && 
  window.location.hostname.includes('ais-pre-dpbgtnjbao4uqwlj2qxcil-361727948318.asia-southeast1.run.app');

if (isBlockedDomain) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center font-sans">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto text-3xl">
            🔒
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">ระบบย้ายเซิร์ฟเวอร์แล้ว</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              เว็บไซต์หลักได้เปิดให้บริการแล้วที่โดเมนอย่างเป็นทางการ กรุณาเข้าใช้งานผ่านช่องทางใหม่เพื่อความรวดเร็วและปลอดภัยยิ่งขึ้น
            </p>
          </div>
          <a
            href="https://restaurant-ordering-pied-psi.vercel.app"
            className="block w-full py-3.5 px-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-medium rounded-xl transition duration-150 shadow-lg shadow-orange-500/20"
          >
            เข้าสู่เว็บไซต์หลัก (Vercel)
          </a>
        </div>
      </div>
    </StrictMode>
  );
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
