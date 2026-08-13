// Firebase Cloud Messaging Service Worker
// App хаалттай байхад notification хүлээн авах

try {
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

  // Service worker нь env уншиж чаддаггүй тул утгыг шууд бичнэ. Эдгээр нь
  // browser-т ил гардаг нийтийн тохиргоо — нууц түлхүүр биш.
  // messagingSenderId ЗААВАЛ байх ёстой: үүнгүйгээр firebase.messaging()
  // алдаа шидээд background мэдэгдэл огт ажиллахгүй.
  const firebaseConfig = {
    apiKey: "AIzaSyB9fXul1pKxb_IJ2nqvlfeIP3qtXT7jYLg",
    authDomain: "bbuch-edba7.firebaseapp.com",
    projectId: "bbuch-edba7",
    storageBucket: "bbuch-edba7.firebasestorage.app",
    messagingSenderId: "1044565839577",
    appId: "1:1044565839577:web:3fe495422eabb4ca67b8c8",
  };

  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Background notification хүлээн авах (app хаалттай байхад)
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message:', payload);

      // ⚠ `notification` талбартай мессежийг Firebase SDK нь ӨӨРӨӨ харуулаад
      // ДАРАА нь энэ hook-ыг дууддаг. Тиймээс энд бас showNotification дуудвал
      // хэрэглэгч мэдэгдлийг ХОЁР удаа хардаг (tag нь өөр учир нийлэхгүй).
      // Манай сервер зөвхөн data-only илгээдэг тул энэ мөчлөг ердийн үед
      // ажиллахгүй — Firebase Console-оос гараар илгээсэн үед л хамгаална.
      if (payload.notification) {
        console.log('[firebase-messaging-sw.js] SDK аль хэдийн харуулсан — алгаслаа');
        return;
      }

      const notificationTitle = payload.notification?.title || payload.data?.title || 'Шинэ мэдэгдэл';
      const notificationBody = payload.notification?.body || payload.data?.body || '';
      const notificationIcon = payload.notification?.icon || payload.data?.icon || '/icons/icon-192x192.png';
      const notificationTag = payload.data?.tag || payload.notification?.tag || 'notification-' + Date.now();
      
      const notificationOptions = {
        body: notificationBody,
        icon: notificationIcon,
        // Badge-ийг Android нь силуэт болгодог тул дэвсгэргүй, нэг өнгийн icon.
        badge: '/icons/badge-72x72.png',
        tag: notificationTag,
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
        data: {
          ...payload.data,
          // Notification ID нэмэх
          id: payload.data?.id || `notification-${Date.now()}`,
          timestamp: Date.now(),
        },
        actions: payload.data?.actions || [],
      };

      // Notification харуулах
      return self.registration.showNotification(notificationTitle, notificationOptions)
        .then(() => {
          console.log('[firebase-messaging-sw.js] Background notification shown:', notificationTitle);
        })
        .catch((error) => {
          console.error('[firebase-messaging-sw.js] Error showing notification:', error);
        });
    });
  } else {
    console.error('[firebase-messaging-sw.js] Firebase is not defined');
  }
} catch (error) {
  console.error('[firebase-messaging-sw.js] Error initializing Firebase:', error);
}

// Notification click event (app хаалттай эсвэл нээлттэй байхад)
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);
  
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/';
  const action = event.action || notificationData.action;
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // Хэрэв app аль хэдийн нээлттэй байвал focus хийх
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Client-д message илгээх (notification click event)
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: notificationData,
            url: urlToOpen,
            action: action,
          });
          return client.focus();
        }
      }
      
      // Хэрэв app нээлттэй биш бол нээх
      // App хаалттай байхад notification дээр дарахад app нээгдэнэ
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Service Worker install event
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker installing...');
  // Шууд идэвхжүүлэх (skip waiting)
  self.skipWaiting();
});

// Service Worker activate event
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker activating...');
  // Бүх client-үүдийг шууд хяналтанд авах
  event.waitUntil(
    clients.claim().then(() => {
      console.log('[firebase-messaging-sw.js] Service Worker activated and claimed clients');
    })
  );
});
