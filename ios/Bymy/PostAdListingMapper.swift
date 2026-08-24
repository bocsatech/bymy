import Foundation

/// SearchFilter draft → Autosweb űrlap JSON (POST /api/listings)
enum PostAdListingMapper {
    static let maxLeirasLength = 700

    static func formData(
        from filter: SearchFilter,
        leiras: String,
        vehicleTitle: String = "Személyautó"
    ) -> [String: Any] {
        var form: [String: Any] = [:]

        if let kind = filter.vehicleKind {
            form["jarmu_kategoria"] = kind
        }

        let brand = filter.gyartmanyok.first
        let model = filter.modellek.first
        if let brand { form["gyartmany"] = brand }
        if let model { form["modell"] = model }

        // Feladáskor egy érték (mindkét filter mező ugyanaz).
        let year = filter.evTol ?? filter.evIg
        if let year { form["gyartasi_ev"] = String(year) }

        let km = filter.kmTol ?? filter.kmIg
        if let km { form["km"] = String(km) }

        let price = filter.arTol ?? filter.arIg
        if let price { form["vetelar"] = String(price) }

        if let fuel = filter.fuels.first {
            form["uzemanyag"] = fuelFormLabel(fuel)
        }

        if let allapot = filter.allapotok.first {
            form["allapot"] = allapot
        }
        if let kivitel = filter.kiviteles.first {
            form["kivitel"] = kivitel
        }
        if let ajtok = filter.ajtok.first {
            form["ajtok"] = ajtok
        }
        if let szemelyek = filter.szemelyek.first {
            form["szemelyek"] = szemelyek
        }
        if let hajtas = filter.hajtasok.first {
            form["hajtas"] = hajtas
        }
        if let okmanyJelleg = filter.okmanyJellegek.first {
            form["okmany_jelleg"] = okmanyJelleg
        }
        if let okmany = filter.okmanyErvenyesseg.first {
            form["okmany_ervenyesseg"] = okmany
        }
        if let hirdeto = filter.hirdetok.first {
            form["hirdeto"] = hirdeto
        }
        if let henger = filter.hengerCm3Tol ?? filter.hengerCm3Ig {
            form["hengerurtartalom"] = String(henger)
        }
        if let kw = filter.kwTol ?? filter.kwIg {
            form["teljesitmeny_kw"] = String(kw)
        }
        if let nm = filter.nyomatekNmTol ?? filter.nyomatekNmIg {
            form["nyomatek_nm"] = String(nm)
        }
        if let st = filter.sajatTomegTol ?? filter.sajatTomegIg {
            form["sajat_tomeg"] = String(st)
        }
        if let ot = filter.osszTomegTol ?? filter.osszTomegIg {
            form["ossztomeg"] = String(ot)
        }
        if let valt = filter.sebessegvaltok.first {
            form["sebessegvalto"] = valt
        }
        if let szin = filter.szinek.first {
            form["szin"] = szin
        }
        if let klima = filter.klima {
            form["klima"] = klima
        }

        // Akkumulátor / hatótáv
        if let kwh = filter.akkumulatorKwhTol ?? filter.akkumulatorKwhIg {
            form["akkumulator_kwh"] = String(kwh)
        }
        if let jkwh = filter.jelenlegiAkkukapacitasTol ?? filter.jelenlegiAkkukapacitasIg {
            form["jelenlegi_akkukapacitas"] = String(jkwh)
        }
        if let ac = filter.acToltoCsatlakozok.first {
            form["ac_tolto_csatlakozo"] = ac
        }
        if let acKw = filter.acToltoTeljesitmenyTol ?? filter.acToltoTeljesitmenyIg {
            form["ac_tolto_teljesitmeny"] = String(acKw)
        }
        if let dc = filter.dcToltoCsatlakozok.first {
            form["dc_tolto_csatlakozo"] = dc
        }
        if let dcKw = filter.dcToltoTeljesitmenyTol ?? filter.dcToltoTeljesitmenyIg {
            form["dc_tolto_teljesitmeny"] = String(dcKw)
        }
        if let wltp = filter.hatotavTol ?? filter.hatotavIg {
            form["wltp_hatotav"] = String(wltp)
        }
        if let ap = filter.autopalyaHatotavTol ?? filter.autopalyaHatotavIg {
            form["autopalya_hatotav"] = String(ap)
        }
        if let teli = filter.teliHatotavTol ?? filter.teliHatotavIg {
            form["teli_hatotav"] = String(teli)
        }
        if filter.villamToltes { form["villamtoltes"] = true }
        if filter.zoldRendszam { form["zold_rendszam"] = true }

        // Raktér
        if let v = filter.rakterTerfogatTol ?? filter.rakterTerfogatIg {
            form["rakter_terfogat"] = String(v)
        }
        if let v = filter.rakterHosszTol ?? filter.rakterHosszIg {
            form["rakter_hossz"] = String(v)
        }
        if let v = filter.rakterSzelessegTol ?? filter.rakterSzelessegIg {
            form["rakter_szelesseg"] = String(v)
        }
        if let v = filter.rakterMagassagTol ?? filter.rakterMagassagIg {
            form["rakter_magassag"] = String(v)
        }
        if let v = filter.doblemezTavolsagTol ?? filter.doblemezTavolsagIg {
            form["doblemez_tavolsag"] = String(v)
        }

        let extras = filter.extras.filter { $0.value }.map(\.key).sorted()
        if !extras.isEmpty {
            form["felszereltseg"] = extras
        }

        let trimmed = String(leiras.prefix(maxLeirasLength))
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            form["leiras"] = trimmed
        }

        let titleParts = [brand, model].compactMap { $0 }.filter { !$0.isEmpty }
        var title = titleParts.joined(separator: " ")
        if title.isEmpty { title = vehicleTitle }
        if let year {
            title = "\(title) (\(year))"
        }
        form["hirdetes_cime"] = title

        return form
    }

    /// Név + telefon + cím a hirdetés űrlapba (Beállításokból előtöltve).
    static func applyContact(
        to form: inout [String: Any],
        name: String,
        phone: String,
        email: String,
        street: String = "",
        postalCode: String = "",
        city: String = ""
    ) {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !n.isEmpty { form["hirdeto_nev"] = n }
        let e = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if !e.isEmpty { form["email"] = e }
        let rawPhone = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rawPhone.isEmpty {
            // Egységes megjelenítési mező + részmezők (részletes oldal mindkettőt olvassa)
            form["telefonszam"] = rawPhone
            let parts = parsePhoneParts(rawPhone)
            if let orszag = parts.orszag { form["telefon1_orszag"] = orszag }
            if let korzet = parts.korzet { form["telefon1_korzet"] = korzet }
            // Ha nincs elég szám a körzet/szám bontáshoz, a teljes számot mentsük
            if let szam = parts.szam, !szam.isEmpty {
                form["telefon1_szam"] = szam
            } else {
                form["telefon1_szam"] = rawPhone.filter(\.isNumber)
            }
        }
        func empty(_ key: String) -> Bool {
            guard let v = form[key] else { return true }
            return String(describing: v).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        let c = city.trimmingCharacters(in: .whitespacesAndNewlines)
        if empty("telepules"), !c.isEmpty { form["telepules"] = c }
        let p = postalCode.trimmingCharacters(in: .whitespacesAndNewlines)
        if empty("iranyitoszam"), !p.isEmpty { form["iranyitoszam"] = p }
        let s = street.trimmingCharacters(in: .whitespacesAndNewlines)
        if empty("megtekintesi_cim"), !s.isEmpty { form["megtekintesi_cim"] = s }
    }

    static func parsePhoneParts(_ raw: String) -> (orszag: String?, korzet: String?, szam: String?) {
        var digits = raw.filter(\.isNumber)
        guard !digits.isEmpty else { return (nil, nil, nil) }
        var orszag = "+36"
        if digits.hasPrefix("36"), digits.count > 2 {
            digits = String(digits.dropFirst(2))
        } else if digits.hasPrefix("06"), digits.count > 2 {
            digits = String(digits.dropFirst(2))
        }
        guard digits.count >= 7 else {
            return (orszag, nil, digits)
        }
        let korzet = String(digits.prefix(2))
        let rest = String(digits.dropFirst(2))
        let formatted: String = {
            if rest.count > 3 {
                let i = rest.index(rest.startIndex, offsetBy: 3)
                return "\(rest[..<i]) \(rest[i...])"
            }
            return rest
        }()
        return (orszag, korzet, formatted)
    }

    static func joinPhone(orszag: String, korzet: String, szam: String) -> String {
        let parts = [orszag, korzet, szam]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return parts.joined(separator: " ")
    }

    /// Mentett űrlap → szerkesztő filter + leírás + elérhetőség.
    static func loadEditState(from form: [String: String]) -> (
        filter: SearchFilter,
        leiras: String,
        contactName: String,
        contactPhone: String
    ) {
        var filter = SearchFilter()
        func s(_ key: String) -> String {
            (form[key] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        func i(_ key: String) -> Int? {
            let digits = s(key).filter(\.isNumber)
            return digits.isEmpty ? nil : Int(digits)
        }

        if !s("gyartmany").isEmpty { filter.gyartmanyok = [s("gyartmany")] }
        if !s("modell").isEmpty { filter.modellek = [s("modell")] }
        if let y = i("gyartasi_ev") { filter.evTol = y; filter.evIg = y }
        if let km = i("km") { filter.kmTol = km; filter.kmIg = km }
        if let ar = i("vetelar") ?? i("akcios_ar") { filter.arTol = ar; filter.arIg = ar }
        if let fuel = fuelFromLabel(s("uzemanyag")) { filter.fuels = [fuel] }
        if !s("allapot").isEmpty { filter.allapotok = [s("allapot")] }
        if !s("kivitel").isEmpty { filter.kiviteles = [s("kivitel")] }
        if !s("ajtok").isEmpty { filter.ajtok = [s("ajtok")] }
        if !s("szemelyek").isEmpty { filter.szemelyek = [s("szemelyek")] }
        if !s("hajtas").isEmpty { filter.hajtasok = [s("hajtas")] }
        if !s("okmany_jelleg").isEmpty { filter.okmanyJellegek = [s("okmany_jelleg")] }
        if !s("okmany_ervenyesseg").isEmpty { filter.okmanyErvenyesseg = [s("okmany_ervenyesseg")] }
        if !s("hirdeto").isEmpty { filter.hirdetok = [s("hirdeto")] }
        if let h = i("hengerurtartalom") { filter.hengerCm3Tol = h; filter.hengerCm3Ig = h }
        if let kw = i("teljesitmeny_kw") { filter.kwTol = kw; filter.kwIg = kw }
        if !s("sebessegvalto").isEmpty { filter.sebessegvaltok = [s("sebessegvalto")] }
        if !s("szin").isEmpty { filter.szinek = [s("szin")] }
        if !s("klima").isEmpty { filter.klima = s("klima") }
        if !s("jarmu_kategoria").isEmpty { filter.vehicleKind = s("jarmu_kategoria") }

        let leiras = s("leiras")
        let name = s("hirdeto_nev")
        let phone = joinPhone(orszag: s("telefon1_orszag"), korzet: s("telefon1_korzet"), szam: s("telefon1_szam"))
        return (filter, leiras, name, phone)
    }

    /// Szerkesztéskor: meglévő form + új mezők; gyártmány/típus (modell) + képek megmaradnak, ha nincs új fotó.
    static func mergeForEdit(
        base: [String: String],
        overlay: [String: Any],
        lockBrandAndType: Bool
    ) -> [String: Any] {
        var out: [String: Any] = [:]
        for (k, v) in base where !v.isEmpty {
            out[k] = v
        }
        for (k, v) in overlay {
            out[k] = v
        }
        if lockBrandAndType {
            if let g = base["gyartmany"], !g.isEmpty { out["gyartmany"] = g }
            if let m = base["modell"], !m.isEmpty { out["modell"] = m }
            if let t = base["tipus"], !t.isEmpty { out["tipus"] = t }
        }
        // Képek: ha az overlay nem küld új fo_kep-et, marad a régi
        if out["fo_kep"] == nil, let fo = base["fo_kep"], !fo.isEmpty {
            out["fo_kep"] = fo
        }
        if out["kepek"] == nil, let k = base["kepek"], !k.isEmpty {
            out["kepek"] = k
        }
        return out
    }

    private static func fuelFormLabel(_ fuel: FuelType) -> String {
        switch fuel {
        case .benzin: return "Benzin"
        case .diesel: return "Dízel"
        case .hybrid: return "Hibrid"
        case .elektromos: return "Elektromos"
        case .benzinGaz: return "Benzin/Gáz"
        }
    }

    private static func fuelFromLabel(_ raw: String) -> FuelType? {
        let v = raw.lowercased()
        if v.contains("dízel") || v.contains("diesel") { return .diesel }
        if v.contains("hibrid") || v.contains("hybrid") { return .hybrid }
        if v.contains("elektrom") { return .elektromos }
        if v.contains("gáz") || v.contains("gaz") { return .benzinGaz }
        if v.contains("benzin") { return .benzin }
        return nil
    }
}
