const CACHE = 'keno-v1';
const GRILLE = [1,7,8,10,12,26,30,39,41,53];
const SEUIL  = 6;
const HEURE  = 20;
const MINUTE = 15;

// Installation
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

// Planification via periodicsync ou fallback setTimeout via message
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE') planifier();
});

function planifier() {
  var now   = new Date();
  var cible = new Date();
  cible.setHours(HEURE, MINUTE, 0, 0);
  if (cible <= now) cible.setDate(cible.getDate() + 1);
  var delai = cible.getTime() - now.getTime();
  setTimeout(verifierTirage, delai);
}

function verifierTirage() {
  var url = 'https://api.codetabs.com/v1/proxy?quest=' +
    encodeURIComponent('https://www.fdj.fr/jeux-de-tirage/keno/resultats');
  fetch(url)
    .then(function(r){ return r.text(); })
    .then(function(t){
      var m = t.match(/\"numbers\":\[([^\]]+)\]/);
      if (!m) return;
      var nums = m[1].match(/\d{1,2}/g).map(Number)
        .filter(function(n){ return n >= 1 && n <= 70; })
        .filter(function(n,i,a){ return a.indexOf(n) === i; });

      var matches = GRILLE.filter(function(n){ return nums.indexOf(n) !== -1; });

      // Extraire date
      var idx = t.indexOf('\"numbers\":[');
      var ctx = t.substring(Math.max(0, idx-400), idx);
      var dm  = ctx.match(/(\d{4}-\d{2}-\d{2})/);
      var date = dm ? dm[1].split('-').reverse().join('/') : '';

      // Notification dans tous les cas
      var titre, corps, icone;
      if (matches.length >= SEUIL) {
        titre  = '🎉 Keno FDJ — ' + matches.length + ' numéros gagnants !';
        corps  = 'Vos numéros : ' + matches.join(', ') + ' — Tirage du ' + date;
        icone  = '🏆';
      } else {
        titre  = '🎱 Keno FDJ — Tirage du ' + date;
        corps  = matches.length + ' numéro(s) correspondant(s) sur 10.';
        icone  = '🎱';
      }

      self.registration.showNotification(titre, {
        body: corps,
        icon: '/keno/icon.png',
        badge: '/keno/icon.png',
        vibrate: matches.length >= SEUIL ? [200,100,200,100,400] : [100],
        tag: 'keno-tirage',
        renotify: true,
        data: { matches: matches.length }
      });

      // Replanifier pour le lendemain
      setTimeout(verifierTirage, 24 * 60 * 60 * 1000);
    })
    .catch(function(){ setTimeout(verifierTirage, 30 * 60 * 1000); }); // retry 30min
}

// Clic sur notification → ouvre l'appli
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/keno/'));
});