import React, { useState, useEffect, useRef } from 'react';
import { MapPin, CheckCircle, Navigation } from 'lucide-react';

interface DeliveryMapProps {
  onLocationSelected: (lat: number, lng: number, addressDesc: string) => void;
  initialLat?: number;
  initialLng?: number;
}

export default function DeliveryMap({ onLocationSelected, initialLat, initialLng }: DeliveryMapProps) {
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // 1. Load Leaflet dynamically
  useEffect(() => {
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      // Clean up script tags if wanted (optional, usually safer to keep in memory)
    };
  }, []);

  // 2. Initialize Map once Leaflet is loaded
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Use default Bangkok coordinates if no initial location
    const defaultLat = initialLat || 13.7563;
    const defaultLng = initialLng || 100.5018;

    // Destroy existing map if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 13,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Custom orange marker icon
    const orangeIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-orange-400 opacity-30"></span>
          <div class="bg-orange-500 text-white p-2 rounded-full border-2 border-slate-900 shadow-lg relative z-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    // Create marker if location exists
    if (pinnedLocation) {
      const marker = L.marker([pinnedLocation.lat, pinnedLocation.lng], { icon: orangeIcon }).addTo(map);
      markerRef.current = marker;
    }

    // Map click handler
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      setPinnedLocation({ lat, lng });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { icon: orangeIcon }).addTo(map);
        markerRef.current = marker;
      }

      onLocationSelected(lat, lng, `📍 พิกัดแผนที่: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [leafletLoaded]);

  // Attempt to fetch user's live position
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ของคุณไม่สนับสนุนระบบระบุพิกัดอัตโนมัติค่ะ');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPinnedLocation({ lat: latitude, lng: longitude });

        const L = (window as any).L;
        if (L && mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);

          const orangeIcon = L.divIcon({
            html: `
              <div class="relative flex items-center justify-center">
                <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-orange-400 opacity-30"></span>
                <div class="bg-orange-500 text-white p-2 rounded-full border-2 border-slate-900 shadow-lg relative z-10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
              </div>
            `,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
          });

          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          } else {
            const marker = L.marker([latitude, longitude], { icon: orangeIcon }).addTo(mapInstanceRef.current);
            markerRef.current = marker;
          }

          onLocationSelected(latitude, longitude, `📍 พิกัดแผนที่: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
      },
      (error) => {
        console.error('Error fetching location:', error);
        alert('ไม่สามารถระบุตำแหน่งของคุณได้โดยอัตโนมัติค่ะ กรุณาคลิกเลือกตำแหน่งบนแผนที่ด้วยตนเองนะคะ');
      }
    );
  };

  return (
    <div className="space-y-2 animate-fadeIn">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <label className="font-medium flex items-center gap-1.5 text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-orange-500 animate-bounce" />
          <span>ปักหมุดตำแหน่งจัดส่งฟรี (OpenStreetMap)</span>
        </label>
        
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-white/5 text-[10px] transition-colors"
        >
          <Navigation className="w-3 h-3 text-orange-400" />
          <span>📍 ค้นหาตำแหน่งของฉัน</span>
        </button>
      </div>

      <div className="relative w-full h-[220px] rounded-xl overflow-hidden border border-white/10 bg-slate-950 shadow-inner">
        {!leafletLoaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-2">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] text-slate-400">กำลังโหลดแผนที่ระบบ OpenStreetMap...</p>
          </div>
        ) : (
          <div ref={mapContainerRef} className="w-full h-full z-10" />
        )}
        
        {leafletLoaded && !pinnedLocation && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-950/95 backdrop-blur-sm px-3.5 py-2.5 rounded-xl border border-white/10 text-center pointer-events-none z-20 shadow-xl animate-bounce">
            <p className="text-[10px] text-slate-200 leading-normal flex items-center justify-center gap-1.5">
              <span>👇</span>
              <strong>แตะจุดที่ต้องการจัดส่งบนแผนที่ได้เลยค่ะ!</strong>
            </p>
          </div>
        )}

        {pinnedLocation && (
          <div className="absolute bottom-3 right-3 bg-emerald-950/95 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-emerald-500/20 text-center pointer-events-none z-20 shadow-lg flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[9px] text-emerald-300 font-mono font-bold">
              ปักหมุดแล้ว ({pinnedLocation.lat.toFixed(5)}, {pinnedLocation.lng.toFixed(5)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
