/*
 * Update 35 B5 (05.11.2026): IndexNow für Bing, Yandex, Seznam, Naver (https://www.indexnow.org/documentation).
 * Der Schlüssel ist kein Geheimnis: Er liegt öffentlich als /<SCHLUESSEL>.txt auf der Website (Besitznachweis).
 * Benutzt von .eleventy.js (Liste der Seiten-Hashes, /indexnow.json) und deploy-succeeded.js (Ping nach dem Deploy).
 */
const SCHLUESSEL = "554e733d8c04d45e757fc333bd1e1805";
const HOST = "fg-realestate.de";
const BASIS = "https://" + HOST;

module.exports = { SCHLUESSEL, HOST, BASIS };
