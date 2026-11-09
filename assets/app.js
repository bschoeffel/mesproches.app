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
    c.appendChild(el("p", "note", g.members + " membres · " + dateLongue(jour(g.event_date)) + " · " + jMoins(jour(g.event_date))));
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
    vide(zone);
    zone.appendChild(el("h1", null, "Mes groupes"));
    var liste = el("div", "liste");
    (r.data || []).filter(function (g) { return !g.archived_at; }).forEach(function (g) {
      var a = el("a", "ligne"); a.href = "#g=" + g.id; a.style.color = "inherit"; a.style.textDecoration = "none";
      a.appendChild(el("div", "ico", g.emoji || "🎉"));
      var t = el("div", "grand"); t.appendChild(el("strong", null, g.name));
      t.appendChild(el("small", null, dateLongue(jour(g.event.event_date)) + " · " + jMoins(jour(g.event.event_date)))); a.appendChild(t);
      liste.appendChild(a);
    });
    if (!liste.firstChild) zone.appendChild(el("p", "sous", "Aucun groupe dans ce navigateur. Ouvrez le lien d'invitation reçu par message."));
    else zone.appendChild(liste);
  }

  async function groupe(zone, uid, gid) {
    memoriser(gid);
    var g = (await sb.from("groups").select("id,name,emoji,event:events(kind,title,event_date)").eq("id", gid).maybeSingle()).data;
    vide(zone);
    if (!g) { zone.appendChild(el("p", "sous", "Ce groupe ne vous est pas (ou plus) ouvert.")); return; }
    var d = jour(g.event.event_date);
    var b = el("div", "bandeau"); b.appendChild(el("span", null, "Recevez le fil en direct"));
    var lienApp = el("a", "lien-rose", "Installer l'app"); lienApp.href = "/#liste-attente"; b.appendChild(lienApp); zone.appendChild(b);
    zone.appendChild(el("h1", null, (g.emoji || "🎉") + " " + g.name));

    var membres = (await sb.from("group_members").select("profile_id,status").eq("group_id", gid).eq("status", "active")).data || [];
    zone.appendChild(el("p", "sous", membres.length + " membres · " + dateLongue(d) + " · " + jMoins(d)));
    var noms = {}; var ids = membres.map(function (m) { return m.profile_id; });
    if (ids.length) ((await sb.from("profiles").select("id,first_name,last_name").in("id", ids)).data || []).forEach(function (p) { noms[p.id] = p.first_name; });

    var taches = (await sb.from("group_tasks").select("kind,assignee_id").eq("group_id", gid)).data || [];
    var puces = el("div", "puces");
    [["gift", "🎁 Cadeau"], ["organisation", "🗓️ Organisé"]].forEach(function (k) {
      var t = taches.filter(function (x) { return x.kind === k[0]; })[0];
      var qui = t && t.assignee_id ? (t.assignee_id === uid ? "vous" : noms[t.assignee_id] || "pris") : "à prendre";
      var p = el("span", "puce" + (t && t.assignee_id ? " ok" : ""), k[1] + " : " + qui);
      if (!t || !t.assignee_id || t.assignee_id === uid) {
        p.style.cursor = "pointer";
        p.title = t && t.assignee_id === uid ? "Je ne m'en occupe plus" : "Je m'en occupe";
        p.onclick = async function () {
          var moi = !(t && t.assignee_id === uid);
          await sb.from("group_tasks").update({ assignee_id: moi ? uid : null, status: moi ? "taken" : "open" }).eq("group_id", gid).eq("kind", k[0]);
          var prenom = (await monProfil(uid)).first_name || "Quelqu'un";
          await sb.from("messages").insert({ group_id: gid, sender_id: uid, kind: "action",
            body: prenom + (moi ? " s'occupe " : " ne s'occupe plus ") + (k[0] === "gift" ? "du cadeau" : "de l'organisation") });
          groupe(zone, uid, gid);
        };
      }
      puces.appendChild(p);
    });
    zone.appendChild(puces);

    // Secret Santa
    if (g.event.kind === "christmas") {
      var tirage = (await sb.from("santa_draws").select("id,budget_cents,exchange_date,status").eq("group_id", gid).maybeSingle()).data;
      if (tirage && tirage.status === "drawn") {
        var bt = el("button", "bouton", "🎅 Découvrir ma personne");
        bt.onclick = function () { santa(zone, uid, gid, tirage, g.name); };
        zone.appendChild(bt);
      } else if (tirage) {
        zone.appendChild(el("p", "note", "🎅 Le tirage du Secret Santa n'est pas encore fait."));
      }
    }

    // Envies publiées dans le groupe
    var publiees = ((await sb.from("group_wishes").select("wish_id").eq("group_id", gid)).data || []).map(function (x) { return x.wish_id; });
    if (publiees.length) {
      var envies = (await sb.from("wishes").select("id,title,url").in("id", publiees)).data || [];
      var resas = (await sb.from("wish_reservations").select("wish_id,reserved_by").in("wish_id", publiees)).data || [];
      zone.appendChild(el("p", "titre-section", "Envies partagées"));
      zone.appendChild(listeEnvies(envies, resas, uid, function () { groupe(zone, uid, gid); }, gid));
    }

    // Le fil
    var fil = (await sb.from("messages").select("kind,body,created_at").eq("group_id", gid).order("created_at").limit(200)).data || [];
    zone.appendChild(el("p", "titre-section", "Le fil"));
    var lf = el("div", "liste");
    fil.forEach(function (m) {
      var l = el("div", "ligne");
      l.appendChild(el("div", "ico", m.kind === "wish" ? "💝" : /cadeau/.test(m.body) ? "🎁" : /organisation/.test(m.body) ? "🗓️" : "✨"));
      var t = el("div", "grand"); t.appendChild(el("strong", null, m.body));
      t.appendChild(el("small", null, new Date(m.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })));
      l.appendChild(t); lf.appendChild(l);
    });
    if (fil.length) zone.appendChild(lf);
    zone.appendChild(el("p", "note", "La discussion arrive bientôt. Touchez « Cadeau » ou « Organisé » pour dire que vous vous en occupez."));
    var retour = el("a", "lien-rose", "‹ Mes groupes"); retour.href = "#"; retour.onclick = function () { setTimeout(groupes, 0); };
    zone.appendChild(el("p")).appendChild(retour);
  }

  function listeEnvies(envies, resas, uid, recharger, gid) {
    var liste = el("div", "liste");
    envies.forEach(function (w) {
      var r = resas.filter(function (x) { return x.wish_id === w.id; })[0];
      var l = el("div", "ligne");
      var t = el("div", "grand"); var titre = el(w.url ? "a" : "span", null, w.title);
      if (w.url) { titre.href = w.url; titre.target = "_blank"; titre.rel = "noopener"; titre.style.color = "inherit"; }
      t.appendChild(titre); l.appendChild(t);
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
            await sb.from("messages").insert({ group_id: gid, sender_id: uid, kind: "action", body: prenom + " a réservé « " + w.title + " »", ref_id: w.id });
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
        var envies = (await sb.from("wishes").select("id,title,url").eq("owner_id", x.receiver_profile)).data || [];
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
    var liste = (await sb.from("wishes").select("id,title,url").eq("owner_id", proprio).order("created_at", { ascending: false })).data || [];
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
