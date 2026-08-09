// Ordre d'affichage de la liste d'achats Metro — relevé du 2026-08-09.
//
// L'ordre du site n'est pas arbitraire : les rubriques sont alphabétiques, et les
// produits le sont à l'intérieur de chaque rubrique (accent-sensible : Metro trie
// "Boite" avant "Boîte", "en dés" avant "émincés"). Vérifié sur les 15 rubriques
// et les 130 références du relevé.
//
// Une même famille apparaît sous PLUSIEURS références Metro (3 tomates, 2 poulets,
// 4 gobelets) parce qu'on prend ce qui est disponible. Un article de l'inventaire
// prend donc le rang de la PREMIÈRE référence de sa famille — sinon les tomates se
// retrouveraient à trois endroits de la liste.
//
// Le relevé brut (130 références) est conservé hors dépôt, ce dépôt étant public :
//   P/topics/metro-shopping-order/metro-refs-2026-08-09.txt
// Quand l'ordre Metro change, on recolle la liste et on régénère ce fichier.
(function (global) {
    'use strict';

    // Ordre = ordre du tableau. `id` = identifiant de l'article dans icItems.
    var LIGNES = [
        { id: 99,  rubrique: 'Apéritif surgelé',     nom: 'Mozza sticks' },
        { id: 90,  rubrique: 'Boucherie',            nom: 'Poulet · 5kg' },
        { id: 58,  rubrique: 'Brasserie',            nom: 'Coca normal' },
        { id: 57,  rubrique: 'Brasserie',            nom: 'Coca Zero' },
        { id: 56,  rubrique: 'Brasserie',            nom: 'Cristaline eau' },
        { id: 46,  rubrique: 'Brasserie',            nom: 'Ice tea pêche' },
        { id: 100, rubrique: 'Brasserie',            nom: 'Orangina' },
        { id: 36,  rubrique: 'Brasserie',            nom: 'Perrier' },
        { id: 26,  rubrique: 'Brasserie',            nom: 'Sprite' },
        { id: 66,  rubrique: 'Charcuterie',          nom: 'Dinde tranchée' },
        { id: 71,  rubrique: 'Crèmerie',             nom: 'Mozzarella râpée' },
        { id: 72,  rubrique: 'Crèmerie',             nom: 'Emmental râpé' },
        { id: 83,  rubrique: 'Crèmerie',             nom: 'Labne Kolios · 5kg' },
        { id: 73,  rubrique: 'Crèmerie',             nom: 'Cheddar râpé' },
        { id: 84,  rubrique: 'Crèmerie',             nom: 'Halloumi' },
        { id: 63,  rubrique: 'Crèmerie',             nom: 'Fromage Wyke' },
        { id: 62,  rubrique: 'Crèmerie',             nom: 'Yaourt Yayla · 1kg' },
        { id: 15,  rubrique: 'Divers',               nom: 'Couvercles salade bol' },
        { id: 77,  rubrique: 'Divers',               nom: 'Radis' },
        { id: 89,  rubrique: 'Épicerie salée',       nom: 'Cannelle' },
        { id: 11,  rubrique: 'Épicerie salée',       nom: 'Farine · 10kg' },
        { id: 7,   rubrique: 'Épicerie salée',       nom: "Huile d'olive · 1L" },
        { id: 2,   rubrique: 'Épicerie salée',       nom: 'Huile tournesol · 10L' },
        { id: 42,  rubrique: 'Épicerie salée',       nom: 'Jus de citron · 1L' },
        { id: 80,  rubrique: 'Épicerie salée',       nom: 'Origan' },
        { id: 81,  rubrique: 'Épicerie salée',       nom: 'Paprika' },
        { id: 64,  rubrique: 'Épicerie salée',       nom: 'Poivre blanc' },
        { id: 91,  rubrique: 'Épicerie salée',       nom: 'Poivre noir' },
        { id: 74,  rubrique: 'Épicerie salée',       nom: 'Sel · 5kg' },
        { id: 65,  rubrique: 'Épicerie salée',       nom: 'Vinaigre blanc' },
        { id: 39,  rubrique: 'Épicerie salée',       nom: 'Moutarde' },
        { id: 88,  rubrique: 'Épicerie salée',       nom: 'Cumin' },
        { id: 21,  rubrique: 'Épicerie salée',       nom: 'Concentré tomate' },
        { id: 85,  rubrique: 'Épicerie salée',       nom: 'Gingembre poudre' },
        { id: 43,  rubrique: 'Épicerie salée',       nom: 'Ketchup' },
        { id: 82,  rubrique: 'Épicerie salée',       nom: 'Mayonnaise' },
        { id: 35,  rubrique: 'Épicerie salée',       nom: 'Olives en rondelles' },
        { id: 59,  rubrique: 'Épicerie salée',       nom: 'Pois chiche' },
        { id: 75,  rubrique: 'Épicerie salée',       nom: 'Romarin' },
        { id: 28,  rubrique: 'Épicerie salée',       nom: 'Sauce sriracha' },
        { id: 17,  rubrique: 'Épicerie salée',       nom: 'Levure' },
        { id: 94,  rubrique: 'Épicerie sucrée',      nom: 'Tahina · 20kg' },
        { id: 69,  rubrique: 'Épicerie sucrée',      nom: 'Sucre · 20kg' },
        { id: 104, rubrique: 'Épicerie sucrée',      nom: 'Capsules café' },
        { id: 48,  rubrique: 'Épicerie sucrée',      nom: 'Miel' },
        { id: 76,  rubrique: 'Épicerie sucrée',      nom: 'Lait en poudre · 10kg' },
        { id: 38,  rubrique: 'Épicerie sucrée',      nom: 'Nutella' },
        { id: 25,  rubrique: 'Épicerie sucrée',      nom: 'Speculoos (pâte)' },
        { id: 27,  rubrique: 'Épicerie sucrée',      nom: 'Biscuits speculoos' },
        { id: 101, rubrique: 'Épicerie sucrée',      nom: 'Acide citrique' },
        { id: 97,  rubrique: 'Fourniture de bureau', nom: 'Bobine imprimante caisse' },
        { id: 98,  rubrique: 'Fourniture de bureau', nom: 'Bobine imprimante carte' },
        { id: 13,  rubrique: 'Fruits et légumes',    nom: 'Bananes' },
        { id: 87,  rubrique: 'Fruits et légumes',    nom: 'Concombre' },
        { id: 79,  rubrique: 'Fruits et légumes',    nom: 'Ail épluché' },
        { id: 8,   rubrique: 'Fruits et légumes',    nom: 'Menthe' },
        { id: 9,   rubrique: 'Fruits et légumes',    nom: 'Laitue iceberg' },
        { id: 67,  rubrique: 'Fruits et légumes',    nom: 'Tomates · 6kg' },
        { id: 96,  rubrique: 'Hygiène & entretien',  nom: 'Liquide vaisselle' },
        { id: 34,  rubrique: 'Hygiène & entretien',  nom: 'Bobine lave-main staff' },
        { id: 20,  rubrique: 'Hygiène & entretien',  nom: 'Dégraissant spray' },
        { id: 51,  rubrique: 'Hygiène & entretien',  nom: 'Gants L' },
        { id: 49,  rubrique: 'Hygiène & entretien',  nom: 'Gants M' },
        { id: 50,  rubrique: 'Hygiène & entretien',  nom: 'Gants S' },
        { id: 102, rubrique: 'Hygiène & entretien',  nom: 'Gants XL' },
        { id: 31,  rubrique: 'Hygiène & entretien',  nom: 'Désinfectant surface' },
        { id: 23,  rubrique: 'Hygiène & entretien',  nom: 'Papier toilette' },
        { id: 22,  rubrique: 'Hygiène & entretien',  nom: 'Sac poubelle · 50L' },
        { id: 41,  rubrique: 'Jetable & emballage',  nom: 'Serviettes en papier' },
        { id: 33,  rubrique: 'Jetable & emballage',  nom: 'Bol salade' },
        { id: 47,  rubrique: 'Jetable & emballage',  nom: 'Gobelets x50' },
        { id: 24,  rubrique: 'Jetable & emballage',  nom: 'Pailles' },
        { id: 52,  rubrique: 'Jetable & emballage',  nom: 'Emballage frites ouvert' },
        { id: 53,  rubrique: 'Jetable & emballage',  nom: 'Emballage frites fermé' },
        { id: 54,  rubrique: 'Jetable & emballage',  nom: 'Fourchettes en bois' },
        { id: 32,  rubrique: 'Jetable & emballage',  nom: 'Papier sandwich' },
        { id: 106, rubrique: 'Jetable & emballage',  nom: 'Cuillère' },
        { id: 30,  rubrique: 'Jetable & emballage',  nom: 'Pot sauce petit' },
        { id: 107, rubrique: 'Jetable & emballage',  nom: 'Pot sauce grand' },
        { id: 29,  rubrique: 'Jetable & emballage',  nom: 'Couvercle pot sauce' },
        { id: 45,  rubrique: 'Jetable & emballage',  nom: 'Sac papier kraft' },
        { id: 6,   rubrique: 'Légume surgelé',       nom: 'Oignons · 2.5kg' },
        { id: 4,   rubrique: 'Légume surgelé',       nom: 'Poivron · 2.5kg' },
        { id: 10,  rubrique: 'Légume surgelé',       nom: 'Frites · 2.5kg' },
        { id: 1,   rubrique: 'Viande surgelé',       nom: 'Égrené viande bœuf · 1kg' },
        { id: 12,  rubrique: 'Viande surgelé',       nom: 'Crispy poulet' }
    ];

    var RANG = {};
    LIGNES.forEach(function (l, i) { RANG[l.id] = i; });

    global.MetroOrder = {
        releve: '2026-08-09',
        lignes: LIGNES,
        taille: LIGNES.length,
        // null (et non -1 ou 9999) pour un article absent de la liste Metro : l'appelant
        // DOIT décider quoi en faire, il ne peut pas le confondre avec un rang réel.
        rang: function (id) {
            var r = RANG[id];
            return r === undefined ? null : r;
        },
        rubrique: function (id) {
            var r = RANG[id];
            return r === undefined ? null : LIGNES[r].rubrique;
        }
    };
})(window);
