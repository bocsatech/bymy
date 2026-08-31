import Foundation

/// Hirdetésfeladás → részletes keresés opciók / extrák (Autosweb equipment-data)
enum DetailedSearchCatalog {
    static let allapotok = ["Normál", "Újszerű", "Sérülésmentes", "Sérült"]

    static let kiviteles = [
        "Pickup", "Terepjáró", "Buggy", "Cabrio", "Coupe", "Egyterű", "Ferdehátú",
        "Hot rod", "Kisbusz", "Kombi", "Lépcsőshátú", "Mopedautó", "Sedan", "Sport",
        "Városi terepjáró (crossover)", "Egyéb",
    ]

    static let ajtok = ["2", "3", "4", "5"]

    static let szemelyek = ["2", "3", "4", "5", "6", "7", "8", "9"]

    /// Okmányok jellege
    static let okmanyok = [
        "Külföldi okmányokkal",
        "Magyar okmányokkal",
        "Okmányok nélkül",
    ]

    static let hirdetok = [
        "Magánszemély",
        "Kereskedés",
    ]

    static let sebessegvaltok = [
        "Manuális",
        "Automata",
    ]

    static let hajtasok = ["Első kerék", "Hátsó kerék", "Összkerék"]

    static let szinek = [
        "Fehér", "Fekete", "Szürke", "Ezüst", "Kék", "Piros", "Zöld", "Barna", "Sárga", "Egyéb",
    ]

    static let klimaOptions = [
        "nincs",
        "manuális klíma",
        "automata klíma",
        "digitális klíma",
        "digitális kétzónás klíma",
        "digitális többzónás klíma",
        "hőszivattyús klíma",
    ]

    static let toltoCsatlakozok = ["Type 2", "CCS", "CHAdeMO", "Schuko / hálózati"]

    static let acToltoCsatlakozok = ["Type 2", "Schuko / hálózati", "Egyéb AC"]
    static let dcToltoCsatlakozok = ["CCS", "CHAdeMO", "Egyéb DC"]

    /// Okmányok jellege (külön az érvényességtől)
    static let okmanyJellegek = [
        "Magyar okmányok",
        "Külföldi okmányok",
    ]

    static let okmanyErvenyessegOnly = [
        "Érvényes",
        "Lejárt",
    ]

    /// Teherautó / kisteher kivitel
    static let teherKiviteles = [
        "Dobozos",
        "Ponyvás",
        "Plató",
        "Hűtős",
        "Billencs",
        "Zárt",
        "Egyéb",
    ]

    /// Teherautó / kisteher extrák
    static let teherEquipmentSections: [(id: String, title: String, items: [String])] = [
        (
            "belter",
            "Beltér",
            [
                "függönylégzsák",
                "hátsó oldal légzsák",
                "kikapcsolható légzsák",
                "oldallégzsák",
                "utasoldali légzsák",
                "vezetőoldali légzsák",
                "bukócső",
                "csomag rögzítő",
                "ISOFIX rendszer",
                "full extra",
                "állófűtés",
                "bőr belső",
                "fűthető ülés",
                "térelválasztó",
                "ülésmagasság állítás",
                "állítható kormány",
                "centrálzár",
                "fedélzeti komputer",
                "szervokormány",
            ]
        ),
        (
            "kulter",
            "Kültér",
            [
                "elektromos ablak",
                "elektromos tükör",
                "fűthető tükör",
                "könnyűfém felni",
                "színezett üveg",
                "vonóhorog",
                "elektromos tető",
                "ködlámpa",
                "xenon fényszóró",
            ]
        ),
        (
            "multimedia",
            "Multimédia / Navigáció",
            [
                "CD tár",
                "CD-s autórádió",
                "GPS (navigáció)",
                "Hi-Fi",
                "rádiós magnó",
            ]
        ),
    ]

    /// Kisteher 3,5 t-ig — Extrák (Klíma külön mező + ezek)
    static let kisteherEquipmentSections: [(id: String, title: String, items: [String])] = [
        (
            "felszereltseg",
            "Felszereltség",
            [
                "állítható kormány",
                "centrálzár",
                "elektromos ablak",
                "elektromos tükör",
                "fedélzeti komputer",
                "fűthető tükör",
                "immobiliser",
                "könnyűfém felni",
                "riasztó",
                "szervokormány",
                "színezett üveg",
                "tempomat",
                "vonóhorog",
            ]
        ),
    ]

    static let equipmentSections: [(id: String, title: String, items: [String])] = [
        (
            "muszaki",
            "Műszaki felszereltség",
            [
                "4WS (összkerékkormányzás)",
                "állítható felfüggesztés",
                "állítható kormány",
                "automatikus hengerlekapcsolás",
                "centrálzár",
                "chiptuning",
                "EDC (elektronikus lengéscsillapítás vezérlés)",
                "elektromos ablak elöl",
                "elektromos ablak hátul",
                "elektromos tükör",
                "fedélzeti komputer",
                "fűthető tükör",
                "HUD / Head-Up Display",
                "kerámia féktárcsák",
                "kétoldali tolóajtó",
                "könnyűfém felni",
                "kormányváltó",
                "króm felni",
                "részecskeszűrő",
                "riasztó",
                "sebességfüggő szervokormány",
                "sperr differenciálmű",
                "sportfutómű",
                "sportülések",
                "start-stop/motormegállító rendszer",
                "szervokormány",
                "színezett üveg",
                "tolóajtó",
                "tolótető - elektromos",
                "tolótető (napfénytető)",
                "vonóhorog",
            ]
        ),
        (
            "kenyelem",
            "Kényelmi felszereltség",
            [
                "full extra",
                "állófűtés",
                "fűthető első ülés",
                "fűthető kormány",
                "álló helyzeti klíma",
                "bőr belső",
                "műbőr-kárpit",
                "360 fokos kamerarendszer",
                "Alcantara kárpit",
                "bőrkormány",
                "digitális műszeregység",
                "elektromos csomagtérajtó-mozgatás",
                "kulcs nélküli indítás",
                "masszírozós ülés",
                "multifunkciós kormánykerék",
                "tolatókamera",
                "tolatóradar",
                "távolsági fényszóró asszisztens",
            ]
        ),
        (
            "biztonsag",
            "Biztonsági felszereltség",
            [
                "függönylégzsák",
                "oldallégzsák",
                "vezetőoldali légzsák",
                "utasoldali légzsák",
                "automata fényszórókapcsolás",
                "LED fényszóró",
                "xenon fényszóró",
                "koccanásgátló",
                "sávtartó rendszer",
                "tempomat",
                "ABS (blokkolásgátló)",
                "ESP (menetstabilizátor)",
                "indításgátló (immobiliser)",
                "ISOFIX rendszer",
                "defekttűrő abroncsok",
            ]
        ),
        (
            "hifi",
            "HiFi és multimédia",
            [
                "GPS (navigáció)",
                "bluetooth-os kihangosító",
                "USB csatlakozó",
                "Android Auto",
                "Apple CarPlay",
                "érintőkijelző",
                "vezeték nélküli telefontöltés",
                "WiFi Hotspot",
            ]
        ),
        (
            "kiegeszito",
            "Kiegészítő felszereltség",
            [
                "defektjavító készlet",
                "otthoni hálózati töltő",
                "pótkerék",
                "tetőcsomagtartó",
                "Type2 töltőkábel",
            ]
        ),
        (
            "egyeb",
            "Egyéb információk",
            [
                "garanciális",
                "azonnal elvihető",
                "első tulajdonostól",
                "garázsban tartott",
                "keveset futott",
                "nem dohányzó",
                "rendszeresen karbantartott",
                "vezetett szervizkönyv",
                "ÁFA visszaigényelhető",
                "autóbeszámítás lehetséges",
            ]
        ),
    ]
}
