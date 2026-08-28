---
layout: base.njk
permalink: "wissen/index.html"
title: "Wissen - Fachartikel zu Kauf, Verkauf und Finanzierung"
description: "Fachartikel zu Ankauf, Verkauf, Vermietung, Bewertung und Finanzierung von Wohn- und Anlageimmobilien."
---
<div class="content-detail shell">
  <nav class="breadcrumbs"><a href="/index.html">Start</a><span>&rsaquo;</span><span>Wissen</span></nav>
  <article class="science-article">
    <header>
      <h1>Wissen</h1>
      <p class="lead">{{ labContent.articles | length }} Fachartikel zu Ankauf, Verkauf, Vermietung, Bewertung und Finanzierung von Wohn- und Anlageimmobilien &mdash; jeder Artikel beantwortet eine konkrete Frage, die in einem Kauf- oder Verkaufsprozess tats&auml;chlich gestellt wird.</p>
    </header>
    <ul class="lex-index">
    {%- for entry in labContent.articles %}
      <li><a href="/wissen/{{ entry.slug }}/"><strong>{{ entry.title }}</strong></a> {{ entry.summary }}</li>
    {%- endfor %}
    </ul>
  </article>
</div>
{#
  O-112 — Übersichtsseite ohne strukturierte Daten. Die Artikel sind jetzt als
  ItemList ausgezeichnet; die Anzahl kommt aus der Datei, damit sie nicht wie
  bisher ("62 Fachartikel" bei 65 Artikeln) veralten kann.
#}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": "https://fg-realestate.de/wissen/",
      "url": "https://fg-realestate.de/wissen/",
      "name": "Wissen",
      "description": "{{ labContent.articles | length }} Fachartikel zu Ankauf, Verkauf, Vermietung, Bewertung und Finanzierung von Wohn- und Anlageimmobilien.",
      "inLanguage": "de-DE",
      "isPartOf": { "@id": "https://fg-realestate.de/#website" },
      "about": { "@id": "https://fg-realestate.de/#organization" },
      "provider": { "@id": "https://fg-realestate.de/#organization" },
      "breadcrumb": { "@id": "https://fg-realestate.de/wissen/#breadcrumb" },
      "mainEntity": { "@id": "https://fg-realestate.de/wissen/#artikel" }
    },
    {
      "@type": "ItemList",
      "@id": "https://fg-realestate.de/wissen/#artikel",
      "name": "Fachartikel",
      "numberOfItems": {{ labContent.articles | length }},
      "itemListOrder": "https://schema.org/ItemListUnordered",
      "itemListElement": [
{%- for entry in labContent.articles %}
        {
          "@type": "ListItem",
          "position": {{ loop.index }},
          "url": "https://fg-realestate.de/wissen/{{ entry.slug }}/",
          "name": {{ entry.title | json | safe }},
          "item": { "@id": "https://fg-realestate.de/wissen/{{ entry.slug }}/#artikel" }
        }{% if not loop.last %},{% endif %}
{%- endfor %}
      ]
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://fg-realestate.de/wissen/#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Start", "item": "https://fg-realestate.de/" },
        { "@type": "ListItem", "position": 2, "name": "Wissen" }
      ]
    }
  ]
}
</script>
