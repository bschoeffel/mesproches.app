// Mes Proches sur le web (étape 4, O17) : rejoindre un groupe, le voir, découvrir son Secret Santa, voir des envies.
// Seule la clé publique est ici : ce que chacun peut lire est décidé par le serveur, ligne par ligne.
// Pas d'inscription : un compte discret est créé dans ce navigateur (gardez la page pour retrouver le groupe).
(function () {
  "use strict";
  var URL_SB = "https://xkmajbnxjqtljuxilamv.supabase.co";
  var CLE = "sb_publishable_teDTd-7udGcPVmTcItmJ6g_5Im3VTQj";
  var sb = window.supabase.createClient(URL_SB, CLE, { auth: { persistSession: true, autoRefreshToken: true } });
  var MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  var JOURS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function vide(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function initiales(nom) { return (nom || "?").split(/\s+/).slice(0, 2).map(function (m) { return m.charAt(0); }).join("").toUpperCase(); }
  function jour(iso) { var p = (iso || "").split("-").map(Number); return p.length === 3 ? new Date(p[0], p[1] - 1, p[2]) : null; }
  function dateLongue(d) { return d ? JOURS[d.getDay()] + " " + (d.getDate() === 1 ? "1er" : d.getDate()) + " " + MOIS[d.getMonth()] : ""; }
  function jMoins(d) { if (!d) return ""; var t = new Date(); t.setHours(0,0,0,0); var n = Math.round((d - t) / 864e5); return n <= 0 ? "aujourd'hui" : "J-" + n; }
  function parametre(nom) { return new URLSearchParams(location.hash.slice(1)).get(nom); }

  async function session() {
    var s = (await sb.auth.getSession()).data.session;
    if (s) return s.user;
    var r = await sb.auth.signInAnonymously();
    if (r.error) throw r.error;
    return r.data.user;
  }

  async function monProfil(uid) {
    var r = await sb.from("profiles").select("first_name,last_name").eq("id", uid).single();
    return r.data || { first_name: "", last_name: "" };
  }

  // Groupes connus de ce navigateur (pour « Mes groupes »)
  function memoriser(gid) {
    try { var l = JSON.parse(localStorage.getItem("mp.groupes") || "[]"); if (l.indexOf(gid) < 0) l.push(gid); localStorage.setItem("mp.groupes", JSON.stringify(l)); } catch (e) {}
  }

  // ───────────────────────── Rejoindre par lien ─────────────────────────
  async function rejoindre() {
    var token = parametre("t");
    var zone = $("app");
    if (!token || !/^[0-9a-f]{18}$/.test(token)) { return pasValable(zone); }
    var uid;
    try { uid = await session(); uid = uid.id; } catch (e) { return panne(zone); }
    var apercu = (await sb.rpc("invite_preview", { p_token: token })).data;
    if (!apercu || !apercu.length) return pasValable(zone);
    var g = apercu[0];

    // Déjà membre : droit au groupe ; demande envoyée : l'attente
    if (g.my_status === "active") { memoriser(g.group_id); location.href = "/groupes/#g=" + g.group_id; return; }
    if (g.my_status === "pending") return attente(zone, g.group_name);
    if (g.my_status === "removed") return pasOuvert(zone);
    vide(zone);
    var c = el("div", "centre");
    c.appendChild(Object.assign(el("img", "icone"), { src: "/assets/icone.png", alt: "" }));
    c.appendChild(el("h1", null, (g.inviter ? g.inviter + " vous invite" : "On vous invite") + " à préparer « " + g.group_name + " »"));
    c.appendChild(el("p", "sous", "Un groupe sans la personne fêtée, pour organiser la surprise ensemble : idées, cadeau, qui s'occupe de quoi."));
    c.appendChild(el("p", "note", g.members + (g.members > 1 ? " membres · " : " membre · ") + dateLongue(jour(g.event_date)) + " · " + jMoins(jour(g.event_date))));
    zone.appendChild(c);

    var profil = await monProfil(uid);
    var form = el("div");
    form.appendChild(el("p", "titre-section", "Comment vous appelez-vous ?"));
    var champs = [["Prénom", "first_name", profil.first_name], ["Nom", "last_name", profil.last_name]].map(function (f) {
      var b = el("div", "champ"); b.appendChild(el("label", null, f[0]));
      var i = el("input"); i.value = f[2] || ""; i.autocomplete = f[1] === "first_name" ? "given-name" : "family-name"; b.appendChild(i); form.appendChild(b); return i;
    });
    form.appendChild(el("p", "note", "Les membres du groupe verront votre prénom et votre nom. Pas de mot de passe, pas de numéro de téléphone."));
    var bouton = el("button", "bouton", "Rejoindre le groupe");
    bouton.style.marginTop = "18px";
    var err = el("p", "erreur cache");
    form.appendChild(bouton); form.appendChild(err);
    form.appendChild(el("p", "note centre", "Gardez cette page : elle vous ramène au groupe, dans ce navigateur."));
    zone.appendChild(form);

    bouton.onclick = async function () {
      var prenom = champs[0].value.trim(), nom = champs[1].value.trim();
      if (!prenom) { err.textContent = "Indiquez au moins votre prénom."; err.classList.remove("cache"); return; }
      bouton.disabled = true; bouton.textContent = "…";
      await sb.from("profiles").update({ first_name: prenom.slice(0, 60), last_name: nom.slice(0, 60) }).eq("id", uid);
      var r = await sb.rpc("join_by_link", { p_token: token });
      if (r.error) {
        err.textContent = /pas ouvert/.test(r.error.message) ? "Ce groupe ne vous est pas ouvert." : "Le lien n'est plus valable : demandez-en un nouveau.";
        err.classList.remove("cache"); bouton.disabled = false; bouton.textContent = "Rejoindre le groupe"; return;
      }
      if (r.data === "active") { memoriser(g.group_id); location.href = "/groupes/#g=" + g.group_id; return; }
      prevenir({ event: "join_request", group_id: g.group_id });
      attente(zone, g.group_name);
    };
  }

  function attente(zone, nom) {
    vide(zone);
    var c = el("div", "centre");
    c.appendChild(el("div", "visages")).appendChild(el("div", "ico", "⏳"));
    c.appendChild(el("h1", null, "Demande envoyée"));
    c.appendChild(el("p", "sous", "L'organisateur de « " + nom + " » doit valider votre arrivée. Revenez sur cette page : elle s'ouvrira sur le groupe dès que c'est fait."));
    var b = el("button", "bouton", "Vérifier maintenant"); b.onclick = function () { location.reload(); };
    c.appendChild(b);
    c.appendChild(el("p", "note", "Sur iPhone, l'app Mes Proches vous préviendra (bêta sur invitation)."));
    zone.appendChild(c);
  }

  function pasOuvert(zone) {
    vide(zone);
    zone.appendChild(el("h1", "centre", "Ce groupe ne vous est pas ouvert"));
  }

  function pasValable(zone) {
    vide(zone);
    var c = el("div", "centre");
    c.appendChild(el("h1", null, "Ce lien n'est plus valable"));
    c.appendChild(el("p", "sous", "Demandez un nouveau lien à l'organisateur du groupe."));
    zone.appendChild(c);
  }

  function panne(zone) {
    vide(zone);
    zone.appendChild(el("p", "erreur centre", "Mes Proches ne répond pas pour l'instant. Vérifiez votre connexion et réessayez."));
  }

  // ───────────────────────── Le groupe ─────────────────────────
  async function groupes() {
    var zone = $("app");
    var uid;
    try { uid = (await session()).id; } catch (e) { return panne(zone); }
    var gid = parametre("g");
    if (gid) return groupe(zone, uid, gid);
    var r = await sb.from("groups").select("id,name,emoji,archived_at,event:events(title,event_date)");
    // Point « nouveau » (comme l'app) : messages des autres depuis ma dernière visite dans ce navigateur
    var actifs = (r.data || []).filter(function (g) { return !g.archived_at; });
    var lus = luLe(), maintenant = new Date().toISOString(), nonLus = {};
    actifs.forEach(function (g) { if (!lus[g.id]) lus[g.id] = maintenant; });
    try { localStorage.setItem("mp.lu", JSON.stringify(lus)); } catch (e) {}
    if (actifs.length) {
      var depuis = actifs.map(function (g) { return lus[g.id]; }).sort()[0];
      var nv = (await sb.from("messages").select("group_id,created_at").in("group_id", actifs.map(function (g) { return g.id; }))
        .neq("sender_id", uid).is("deleted_at", null).gt("created_at", depuis).limit(1000)).data || [];
      nv.forEach(function (m) { if (m.created_at > lus[m.group_id]) nonLus[m.group_id] = (nonLus[m.group_id] || 0) + 1; });
    }
    vide(zone);
    zone.appendChild(el("h1", null, "Mes groupes"));
    var liste = el("div", "liste");
    actifs.forEach(function (g) {
      var a = el("a", "ligne"); a.href = "#g=" + g.id; a.style.color = "inherit"; a.style.textDecoration = "none";
      a.appendChild(el("div", "ico", g.emoji || "🎉"));
      var t = el("div", "grand"); t.appendChild(el("strong", null, g.name));
      t.appendChild(el("small", null, dateLongue(jour(g.event.event_date)) + " · " + jMoins(jour(g.event.event_date)))); a.appendChild(t);
      var n = nonLus[g.id] || 0;
      if (n) a.appendChild(el("span", "nouveaux", n > 1 ? n + " nouveaux" : "1 nouveau"));
      liste.appendChild(a);
    });
    if (!liste.firstChild) zone.appendChild(el("p", "sous", "Aucun groupe dans ce navigateur. Ouvrez le lien d'invitation reçu par message."));
    else zone.appendChild(liste);
  }

  function luLe() { try { return JSON.parse(localStorage.getItem("mp.lu") || "{}"); } catch (e) { return {}; } }
  function marquerLu(gid) { var l = luLe(); l[gid] = new Date().toISOString(); try { localStorage.setItem("mp.lu", JSON.stringify(l)); } catch (e) {} }

  async function groupe(zone, uid, gid) {
    memoriser(gid); marquerLu(gid);
    var g = (await sb.from("groups").select("id,name,emoji,event:events(kind,title,event_date)").eq("id", gid).maybeSingle()).data;
    vide(zone);
    if (!g) { zone.appendChild(el("p", "sous", "Ce groupe ne vous est pas (ou plus) ouvert.")); return; }
    var d = jour(g.event.event_date);
    var b = el("div", "bandeau"); b.appendChild(el("span", null, "Recevez le fil en direct"));
    var lienApp = el("a", "lien-rose", "Installer l'app"); lienApp.href = "/#liste-attente"; b.appendChild(lienApp); zone.appendChild(b);
    zone.appendChild(el("h1", null, (g.emoji || "🎉") + " " + g.name));

    var membres = (await sb.from("group_members").select("profile_id,status").eq("group_id", gid).eq("status", "active")).data || [];
    zone.appendChild(el("p", "sous", membres.length + (membres.length > 1 ? " membres · " : " membre · ") + dateLongue(d) + " · " + jMoins(d)));
    var noms = {}; var ids = membres.map(function (m) { return m.profile_id; });
    if (ids.length) ((await sb.from("profiles").select("id,first_name,last_name,avatar_path").in("id", ids)).data || []).forEach(function (p) { noms[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Un proche"; AVATARS[p.id] = p.avatar_path || null; });

    // Groupe allégé (9/11/2026, comme l'app) : cadeau, organisation et Secret Santa passent par le « + »
    var taches = (await sb.from("group_tasks").select("kind,assignee_id").eq("group_id", gid)).data || [];
    var tirage = g.event.kind === "christmas"
      ? (await sb.from("santa_draws").select("id,budget_cents,exchange_date,status").eq("group_id", gid).maybeSingle()).data : null;

    // Envies publiées dans le groupe
    var publiees = ((await sb.from("group_wishes").select("wish_id").eq("group_id", gid)).data || []).map(function (x) { return x.wish_id; });
    if (publiees.length) {
      var envies = (await sb.from("wishes").select("id,title,url,price_cents").in("id", publiees)).data || [];
      var resas = (await sb.from("wish_reservations").select("wish_id,reserved_by").in("wish_id", publiees)).data || [];
      zone.appendChild(el("p", "titre-section", "Envies partagées"));
      zone.appendChild(listeEnvies(envies, resas, uid, function () { groupe(zone, uid, gid); }, gid));
    }

    // La discussion
    var filZone = el("div", "fil"); zone.appendChild(filZone);
    await dessinerFil(filZone, uid, gid, noms);
    var saisie = el("form", "saisie");
    var champ = el("textarea"); champ.rows = 1; champ.placeholder = "Message"; champ.maxLength = 4000;
    var envoyer = el("button", "bouton", "Envoyer"); envoyer.type = "submit";
    // Le « + » : Secret Santa (Noël), cadeau, organisation
    var plus = el("button", "plus", "+"); plus.type = "button"; plus.title = "Ajouter au fil";
    var menu = el("div", "menu-plus cache");
    function entree(texte, actif, action) {
      var b = el("button", null, texte); b.type = "button"; b.disabled = !actif;
      b.onclick = async function () { menu.classList.add("cache"); await action(); };
      menu.appendChild(b);
    }
    if (tirage && tirage.status === "drawn") entree("🎅 Découvrir ma personne", true, function () { santa(zone, uid, gid, tirage, g.name); });
    else if (tirage) entree("🎅 Secret Santa · le tirage n'est pas encore fait", false, function () {});
    [["gift", "du cadeau", "🎁"], ["organisation", "de l'organisation", "🗓️"]].forEach(function (k) {
      var t = taches.filter(function (x) { return x.kind === k[0]; })[0];
      var mienne = t && t.assignee_id === uid, prise = t && t.assignee_id && !mienne;
      entree(k[2] + (mienne ? " Je ne m'occupe plus " : " Je m'occupe ") + k[1], !prise, async function () {
        await sb.from("group_tasks").update({ assignee_id: mienne ? null : uid, status: mienne ? "open" : "taken" }).eq("group_id", gid).eq("kind", k[0]);
        var prenom = (await monProfil(uid)).first_name || "Quelqu'un";
        await ecrire({ group_id: gid, sender_id: uid, kind: "action", body: prenom + (mienne ? " ne s'occupe plus " : " s'occupe ") + k[1] });
        groupe(zone, uid, gid);
      });
    });
    plus.onclick = function () { menu.classList.toggle("cache"); };
    saisie.appendChild(menu); saisie.appendChild(plus);
    saisie.appendChild(champ); saisie.appendChild(envoyer);
    champ.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saisie.requestSubmit(); } };
    saisie.onsubmit = async function (e) {
      e.preventDefault();
      var texte = champ.value.trim(); if (!texte) return;
      champ.value = "";
      await ecrire({ group_id: gid, sender_id: uid, kind: "text", body: texte });
      dessinerFil(filZone, uid, gid, noms);
    };
    zone.appendChild(saisie);
    // Temps réel (9/11/2026) : le fil se relit dès qu'il se passe quelque chose dans le groupe
    if (window.__filCanal) sb.removeChannel(window.__filCanal);
    var relire = function () { if (document.body.contains(filZone)) dessinerFil(filZone, uid, gid, noms); };
    var mien = "group_id=eq." + gid;
    window.__filCanal = sb.channel("groupe-" + gid)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: mien }, relire)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_tasks", filter: mien }, relire)
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, relire)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, relire)
      .subscribe();
    // Filet de sécurité : une relecture par minute
    clearInterval(window.__filMinuteur);
    window.__filMinuteur = setInterval(function () {
      if (!document.body.contains(filZone)) { clearInterval(window.__filMinuteur); if (window.__filCanal) sb.removeChannel(window.__filCanal); return; }
      if (!document.hidden) dessinerFil(filZone, uid, gid, noms);
    }, 60000);
    var retour = el("a", "lien-rose", "‹ Mes groupes"); retour.href = "#"; retour.onclick = function () { setTimeout(groupes, 0); };
    zone.appendChild(el("p")).appendChild(retour);
  }

  // Notifications (9/11/2026) : après chaque message, les membres qui ont l'app sont prévenus sur leur iPhone.
  function prevenir(corps) { sb.functions.invoke("notifier", { body: corps }).catch(function () {}); }
  async function ecrire(ligne) {
    var r = await sb.from("messages").insert(ligne).select("id").single();
    if (r.data) prevenir({ event: "message", group_id: ligne.group_id, message_id: r.data.id });
    return r;
  }

  var RAPIDES = ["❤️", "😂", "😮", "😢", "👍", "🎉"];

  // Les liens du texte deviennent cliquables, sans jamais interpréter le texte comme du HTML.
  function avecLiens(texte) {
    var bloc = el("div");
    var morceaux = (texte || "").split(/(https?:\/\/[^\s<>"]+)/g);
    morceaux.forEach(function (m, i) {
      if (i % 2 === 1) {
        var a = el("a", "lien", m);
        a.href = m; a.target = "_blank"; a.rel = "noopener noreferrer";
        bloc.appendChild(a);
      } else if (m) bloc.appendChild(document.createTextNode(m));
    });
    return bloc;
  }

  // Photos de la discussion : lues une fois (espace privé, réservé aux membres), puis gardées le temps de la page.
  var PHOTOS = {};
  function photo(chemin) {
    if (!PHOTOS[chemin]) PHOTOS[chemin] = sb.storage.from("discussion").download(chemin)
      .then(function (r) { return r.data ? URL.createObjectURL(r.data) : null; });
    return PHOTOS[chemin];
  }

  // Photo de l'auteur à côté de la dernière bulle d'une série (comme l'app), sinon ses initiales
  var AVATARS = {}, CARTES = {};
  function avatar(pid, nom) {
    var a = el("span", "av-auteur", initiales(nom));
    var chemin = AVATARS[pid];
    if (chemin) {
      if (!CARTES[chemin]) CARTES[chemin] = sb.storage.from("cartes").download(chemin)
        .then(function (r) { return r.data ? URL.createObjectURL(r.data) : null; });
      CARTES[chemin].then(function (url) { if (url) { vide(a); var i = el("img"); i.src = url; i.alt = ""; a.appendChild(i); } });
    }
    return a;
  }

  async function dessinerFil(filZone, uid, gid, noms) {
    var r = await sb.from("messages").select("id,kind,body,sender_id,ref_id,created_at,deleted_at,photo_path,link_url,link_title,link_description,link_site,link_image_path")
      .eq("group_id", gid).order("created_at", { ascending: false }).limit(300);
    var fil = (r.data || []).reverse();
    var ids = fil.map(function (m) { return m.id; });
    var coeurs = ids.length ? ((await sb.from("reactions").select("message_id,profile_id,emoji").in("message_id", ids)).data || []) : [];
    var pids = fil.filter(function (m) { return m.kind === "poll" && m.ref_id; }).map(function (m) { return m.ref_id; });
    var sondages = {}, options = [], votes = [];
    if (pids.length) {
      ((await sb.from("polls").select("id,question").in("id", pids)).data || []).forEach(function (p) { sondages[p.id] = p; });
      options = (await sb.from("poll_options").select("id,poll_id,label,position").in("poll_id", pids)).data || [];
      votes = (await sb.from("poll_votes").select("poll_id,option_id,profile_id").in("poll_id", pids)).data || [];
    }
    var bas = filZone.scrollHeight - filZone.scrollTop - filZone.clientHeight < 40;
    vide(filZone);
    function heure(m) { return new Date(m.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    marquerLu(gid);
    fil.forEach(function (m, i) {
      var mien = m.sender_id === uid;
      var suivant = fil[i + 1];
      var finSerie = !suivant || suivant.kind !== "text" || suivant.sender_id !== m.sender_id;
      if (m.kind === "text") {
        var ligne = el("div", "bulle-ligne" + (mien ? " mien" : ""));
        var bulle = el("div", "bulle" + (mien ? " mien" : ""));
        if (noms[m.sender_id]) bulle.appendChild(el("strong", "auteur", noms[m.sender_id]));
        if (m.photo_path && !m.deleted_at) {
          // Photo envoyée depuis l'iPhone (9/11/2026) : un clic l'ouvre en grand
          bulle.classList.add("avec-photo");
          var img = el("img", "photo");
          img.alt = "Photo" + (noms[m.sender_id] && !mien ? " de " + noms[m.sender_id] : "");
          photo(m.photo_path).then(function (url) { if (url) { img.src = url; img.onclick = function () { window.open(url, "_blank"); }; } });
          bulle.appendChild(img);
        }
        // Aperçu du lien, lu par l'expéditeur (9/11/2026)
        if (m.link_url && !m.deleted_at && /^https?:\/\//i.test(m.link_url)) {
          var carte = el("a", "apercu");
          carte.href = m.link_url; carte.target = "_blank"; carte.rel = "noopener noreferrer";
          if (m.link_image_path) {
            var vignette = el("img");
            vignette.alt = "";
            photo(m.link_image_path).then(function (url) { if (url) vignette.src = url; });
            carte.appendChild(vignette);
          }
          var infos = el("div");
          if (m.link_title) infos.appendChild(el("strong", null, m.link_title));
          if (m.link_description) infos.appendChild(el("span", null, m.link_description));
          infos.appendChild(el("small", null, m.link_site || ""));
          carte.appendChild(infos);
          bulle.appendChild(carte);
        }
        if (!m.photo_path || m.body || m.deleted_at)
          bulle.appendChild(m.deleted_at ? el("div", "efface", "Message supprimé") : avecLiens(m.body));
        bulle.appendChild(el("small", null, heure(m)));
        if (mien) ligne.appendChild(bulle);
        else {
          var rang = el("div", "rang");
          rang.appendChild(finSerie ? avatar(m.sender_id, noms[m.sender_id]) : el("span", "av-auteur vide"));
          rang.appendChild(bulle); ligne.appendChild(rang);
        }
        var mc = coeurs.filter(function (c) { return c.message_id === m.id; });
        if (!m.deleted_at) {
          var outils = el("div", "outils");
          // Les 6 réactions rapides, puis celles mises depuis l'iPhone avec « + »
          var emojis = RAPIDES.slice();
          mc.forEach(function (c) { if (emojis.indexOf(c.emoji) < 0) emojis.push(c.emoji); });
          emojis.forEach(function (e) {
            var n = mc.filter(function (c) { return c.emoji === e; }).length;
            var aMoi = mc.some(function (c) { return c.emoji === e && c.profile_id === uid; });
            var b = el("button", "coeur" + (aMoi ? " on" : n ? " mis" : ""), e + (n ? " " + n : ""));
            b.title = aMoi ? "Retirer" : "Réagir";
            b.onclick = async function () {
              if (aMoi) await sb.from("reactions").delete().eq("message_id", m.id).eq("profile_id", uid).eq("emoji", e);
              else await sb.from("reactions").insert({ message_id: m.id, profile_id: uid, emoji: e });
              dessinerFil(filZone, uid, gid, noms);
            };
            outils.appendChild(b);
          });
          if (mien) {
            var suppr = el("button", "lien-gris", "Supprimer");
            suppr.onclick = async function () {
              if (!confirm("Supprimer ce message ?")) return;
              await sb.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", m.id);
              if (m.photo_path) await sb.storage.from("discussion").remove([m.photo_path]);
              dessinerFil(filZone, uid, gid, noms);
            };
            outils.appendChild(suppr);
          }
          ligne.appendChild(outils);
        }
        filZone.appendChild(ligne);
      } else if (m.kind === "poll" && sondages[m.ref_id]) {
        var p = sondages[m.ref_id];
        var carte = el("div", "carte-sondage");
        carte.appendChild(el("strong", null, "📊 " + p.question + (noms[m.sender_id] && !mien ? " · " + noms[m.sender_id] : "")));
        var vs = votes.filter(function (v) { return v.poll_id === p.id; });
        var monVote = (vs.filter(function (v) { return v.profile_id === uid; })[0] || {}).option_id;
        options.filter(function (o) { return o.poll_id === p.id; }).sort(function (a, b) { return a.position - b.position; }).forEach(function (o) {
          var n = vs.filter(function (v) { return v.option_id === o.id; }).length;
          var b = el("button", "option" + (monVote === o.id ? " on" : ""));
          b.appendChild(el("span", null, (monVote === o.id ? "◉ " : "○ ") + o.label));
          var barre = el("span", "barre"); var plein = el("span"); plein.style.width = (vs.length ? Math.round(100 * n / vs.length) : 0) + "%";
          barre.appendChild(plein); b.appendChild(barre); b.appendChild(el("small", null, String(n)));
          b.onclick = async function () {
            await sb.from("poll_votes").upsert({ poll_id: p.id, option_id: o.id, profile_id: uid }, { onConflict: "poll_id,profile_id" });
            dessinerFil(filZone, uid, gid, noms);
          };
          carte.appendChild(b);
        });
        filZone.appendChild(carte);
      } else {
        var l = el("div", "ligne");
        l.appendChild(el("div", "ico", m.kind === "wish" ? "💝" : /cadeau/.test(m.body) ? "🎁" : /organisation/.test(m.body) ? "🗓️" : /Santa/.test(m.body) ? "🎅" : "✨"));
        var t = el("div", "grand"); t.appendChild(el("strong", null, m.body || ""));
        t.appendChild(el("small", null, heure(m)));
        l.appendChild(t); filZone.appendChild(l);
      }
    });
    if (!fil.length) filZone.appendChild(el("p", "note", "Pas encore de message. Lancez la discussion !"));
    if (bas) filZone.scrollTop = filZone.scrollHeight;
  }

  function listeEnvies(envies, resas, uid, recharger, gid) {
    var liste = el("div", "liste");
    envies.forEach(function (w) {
      var r = resas.filter(function (x) { return x.wish_id === w.id; })[0];
      var l = el("div", "ligne");
      var t = el("div", "grand"); var titre = el(w.url ? "a" : "span", null, w.title);
      if (w.url) { titre.href = w.url; titre.target = "_blank"; titre.rel = "noopener"; titre.style.color = "inherit"; }
      t.appendChild(titre);
      // Prix (9/11/2026), s'il est connu
      if (w.price_cents != null) {
        var c = w.price_cents, e = Math.floor(c / 100), r = c % 100;
        t.appendChild(el("small", "prix", e + (r ? "," + (r < 10 ? "0" : "") + r : "") + " €"));
      }
      l.appendChild(t);
      if (r && r.reserved_by === uid) {
        var b1 = el("button", "lien-rose", "Pris par vous");
        b1.onclick = async function () { await sb.from("wish_reservations").delete().eq("wish_id", w.id).eq("reserved_by", uid); recharger(); };
        l.appendChild(b1);
      } else if (r) {
        l.appendChild(el("small", null, "Déjà pris"));
      } else {
        var b2 = el("button", "lien-rose", "Je le prends");
        b2.onclick = async function () {
          await sb.from("wish_reservations").insert({ wish_id: w.id, reserved_by: uid });
          if (gid) {
            var prenom = (await monProfil(uid)).first_name || "Quelqu'un";
            await ecrire({ group_id: gid, sender_id: uid, kind: "action", body: prenom + " a réservé « " + w.title + " »", ref_id: w.id });
          }
          recharger();
        };
        l.appendChild(b2);
      }
      liste.appendChild(l);
    });
    return liste;
  }

  async function santa(zone, uid, gid, tirage, nomGroupe) {
    var r = (await sb.rpc("my_santa", { p_draw: tirage.id })).data || [];
    vide(zone);
    if (!r.length) { zone.appendChild(el("p", "sous", "Vous ne participez pas à ce tirage.")); return; }
    for (var i = 0; i < r.length; i++) {
      var x = r[i];
      var nom = x.receiver_child_name || [x.receiver_first_name, x.receiver_last_name].filter(Boolean).join(" ") || "Un proche";
      var env = el("div", "enveloppe");
      env.appendChild(el("div", "note", "🎅 Secret Santa · " + nomGroupe)).style.color = "rgba(255,255,255,.8)";
      env.appendChild(el("div", "rond", initiales(nom)));
      env.appendChild(el("div", null, x.giver_child_name ? x.giver_child_name + " offre à" : "Vous offrez à"));
      env.appendChild(el("h2", null, nom));
      var p = el("div", "puces"); p.style.justifyContent = "center";
      if (tirage.budget_cents) p.appendChild(el("span", "puce", "💶 " + (tirage.budget_cents / 100) + " € max"));
      if (tirage.exchange_date) { var d = jour(tirage.exchange_date); p.appendChild(el("span", "puce", "🎁 " + d.getDate() + " " + MOIS[d.getMonth()])); }
      env.appendChild(p);
      zone.appendChild(env);
      if (x.receiver_profile) {
        var envies = (await sb.from("wishes").select("id,title,url,price_cents").eq("owner_id", x.receiver_profile)).data || [];
        if (envies.length) {
          var resas = (await sb.from("wish_reservations").select("wish_id,reserved_by").in("wish_id", envies.map(function (w) { return w.id; }))).data || [];
          zone.appendChild(el("p", "titre-section", "Ses envies"));
          zone.appendChild(listeEnvies(envies, resas, uid, function () { santa(zone, uid, gid, tirage, nomGroupe); }));
        }
      }
      zone.appendChild(el("p", "note", "🤫 Gardez le secret : dans le groupe, personne ne voit votre tirage."));
    }
    var retour = el("a", "lien-rose", "‹ Retour au groupe"); retour.href = "#g=" + gid; retour.onclick = function () { setTimeout(groupes, 0); };
    zone.appendChild(el("p")).appendChild(retour);
  }

  // ───────────────────────── Les envies d'un proche ─────────────────────────
  async function envies() {
    var token = parametre("t"), zone = $("app");
    if (!token || !/^[0-9a-f]{24}$/.test(token)) return;
    var uid;
    try { uid = (await session()).id; } catch (e) { return panne(zone); }
    var r = await sb.rpc("open_wishes", { p_token: token });
    if (r.error) return pasValable(zone);
    var proprio = r.data;
    var p = (await sb.from("profiles").select("first_name,last_name").eq("id", proprio).single()).data || {};
    var liste = (await sb.from("wishes").select("id,title,url,price_cents").eq("owner_id", proprio).order("created_at", { ascending: false })).data || [];
    var resas = liste.length ? (await sb.from("wish_reservations").select("wish_id,reserved_by").in("wish_id", liste.map(function (w) { return w.id; }))).data || [] : [];
    vide(zone);
    zone.appendChild(el("h1", null, "Les envies de " + (p.first_name || "votre proche")));
    zone.appendChild(el("p", "sous", "« Je le prends » réserve une envie pour les autres. " + (p.first_name || "La personne") + " ne voit jamais ce qui est pris."));
    if (liste.length) zone.appendChild(listeEnvies(liste, resas, uid, envies));
    else zone.appendChild(el("p", "note", "Pas encore d'envie : revenez plus tard, la liste se met à jour toute seule."));
  }

  window.MesProches = { rejoindre: rejoindre, groupes: groupes, envies: envies };
  window.addEventListener("hashchange", function () { if (document.body.dataset.page === "groupes") groupes(); });
})();
