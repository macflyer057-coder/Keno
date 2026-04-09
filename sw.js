const GRILLE  = [1,7,8,10,12,26,30,39,41,53];
const SEUIL   = 6;
const NTFY_TOPIC = 'keno-VOTRE-NOM'; // ← changez ce nom (unique)

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE') planifier();
});

function planifier() {
  var now   = new Date();
  var cible = new Date();
  cible.setHours(20, 15, 0, 0);
  if (cible <= now) cible.setDate(cible.getDate() + 1);
  var delai = cible - now;
  setTimeout(verifierTirage, delai);
  console.log('[SW Keno] Prochain tirage dans', Math.round(delai/60000), 'min');
}

function verifierTirage() {
  var url = 'https://api.codetabs.com/v1/proxy?quest=' +
    encodeURIComponent('https://www.fdj.fr/jeux-de-tirage/keno/resultats');
  fetch(url)
    .then(r => r.text())
    .then(t => {
      var m = t.match(/\\"numbers\\":\[([^\]]+)\]/);
      if (!m) { retry(); return; }
      var nums = m[1].match(/\d{1,2}/g).map(Number)
        .filter(n => n >= 1 && n <= 70)
        .filter((n,i,a) => a.indexOf(n) === i);
      var matches = GRILLE.filter(n => nums.includes(n));
      var idx = t.indexOf('\\"numbers\\":[');
      var ctx = t.substring(Math.max(0,idx-400), idx);
      var dm  = ctx.match(/(\d{4}-\d{2}-\d{2})/);
      var date = dm ? dm[1].split('-').reverse().join('/') : '';

      var titre = matches.length >= SEUIL
        ? '🎉 ' + matches.length + ' numéros gagnants !'
        : '🎱 Keno du ' + date;
      var corps = matches.length >= SEUIL
        ? 'Numéros : ' + matches.join(', ') + ' — Tirage du ' + date
        : matches.length + '/10 numéros correspondent.';

      // Notification locale navigateur
      self.registration.showNotification(titre, {
        body: corps, tag: 'keno', renotify: true,
        vibrate: matches.length >= SEUIL ? [300,100,300,100,600] : [100]
      });

      // Notification ntfy (reçue même si Chrome est fermé)
      fetch('https://ntfy.sh/' + NTFY_TOPIC, {
        method: 'POST',
        headers: {
          'Title': titre,
          'Priority': matches.length >= SEUIL ? 'urgent' : 'default',
          'Tags': matches.length >= SEUIL ? 'tada' : 'dart'
        },
        body: corps
      });

      // Replanifier pour le lendemain
      setTimeout(verifierTirage, 24 * 3600 * 1000);
    })
    .catch(retry);
}

function retry() {
  setTimeout(verifierTirage, 30 * 60 * 1000); // réessai dans 30min
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('./'));
});
