import type { ReactNode } from "react";
import { Lead, H2, H3, P, UL, OL, A, ShopCTA } from "./Prose";

/** Article bodies keyed by slug — rendered by app/blog/[slug]/page.tsx. */

function BeneficiiMierePoliflora() {
  return (
    <>
      <Lead>
        Mierea polifloră este, poate, cea mai completă miere naturală pe care o poți pune pe masă. Provine
        din nectarul a zeci de flori de câmp — trifoi, salvie, cimbrișor, sunătoare, lavandă, floarea
        soarelui — pe care albinele le adună în plin cules de vară. Tocmai această diversitate o transformă
        într-un adevărat concentrat de enzime, antioxidanți și minerale.
      </Lead>

      <H2>Ce este, de fapt, mierea polifloră</H2>
      <P>
        Spre deosebire de soiurile monoflore (precum mierea de salcâm sau cea de tei), mierea polifloră nu
        provine dintr-o singură sursă florală. Albinele culeg nectar și polen din pajiștile bogate ale
        verii, iar fiecare lot poartă amprenta locului și a sezonului. De aceea culoarea variază de la
        auriu deschis la chihlimbariu, iar gustul este complex, cu note florale și ușor caramelizate.
      </P>

      <H2>Beneficiile mierii poliflora</H2>
      <H3>1. Bogată în antioxidanți și flavonoide</H3>
      <P>
        Diversitatea florală înseamnă o paletă largă de compuși bioactivi: flavonoide, acizi fenolici și
        antioxidanți care ajută organismul să neutralizeze radicalii liberi. Cu cât culesul e mai variat,
        cu atât profilul antioxidant e mai complet.
      </P>
      <H3>2. Susține sistemul imunitar</H3>
      <P>
        Polenul prezent natural în mierea crudă, alături de enzime și urme de propolis, sprijină imunitatea.
        O lingură de miere polifloră dimineața, pe stomacul gol, este un tonic apreciat de generații întregi.
      </P>
      <H3>3. Energie naturală, ușor de asimilat</H3>
      <P>
        Zaharurile naturale din miere — fructoză și glucoză — oferă energie rapidă, fără șocul glicemic al
        zahărului rafinat. Este ideală pentru copii, sportivi și pentru oricine are nevoie de un plus de
        vitalitate.
      </P>
      <H3>4. Minerale și enzime vii</H3>
      <P>
        Mierea polifloră naturală conține calciu, magneziu, potasiu și enzime precum diastaza și invertaza —
        cu condiția să fie miere crudă, neîncălzită. Pasteurizarea distruge aceste enzime, motiv pentru care
        recoltarea prin extracție la rece este esențială.
      </P>

      <ShopCTA href="/magazin/miere-poliflora" label="Comandă miere polifloră">
        Mierea noastră polifloră este recoltată manual din pajiștile României și extrasă la rece, ca să
        păstreze toate enzimele și antioxidanții.
      </ShopCTA>

      <H2>Cum o consumi corect</H2>
      <UL>
        <li>Nu o adăuga în lichide fierbinți peste 40°C — căldura distruge enzimele.</li>
        <li>Folosește o linguriță de lemn sau ceramică, nu metal, pentru a-i păstra calitățile.</li>
        <li>Păstreaz-o la temperatura camerei, ferită de lumină directă.</li>
      </UL>

      <H2>Cristalizarea nu e un defect</H2>
      <P>
        Dacă mierea ta polifloră se „zaharisește", e un semn bun: cristalizarea este un proces natural,
        specific mierii autentice. Afli mai multe în articolul nostru despre{" "}
        <A href="/blog/de-ce-cristalizeaza-mierea">de ce cristalizează mierea naturală</A>. Iar dacă vrei să
        fii sigur că ai în față o miere pură, citește{" "}
        <A href="/blog/cum-recunosti-mierea-naturala">cum recunoști mierea naturală</A>.
      </P>
      <P>
        Descoperă întreaga gamă în <A href="/magazin">magazinul nostru de miere naturală</A> sau află{" "}
        <A href="/despre-noi">povestea stupinei Fagurul de Aur</A>.
      </P>
    </>
  );
}

function MiereCrudaVsPasteurizata() {
  return (
    <>
      <Lead>
        „Miere crudă" și „raw honey" sunt termeni tot mai căutați — și pe bună dreptate. Diferența dintre
        mierea crudă și cea pasteurizată nu ține doar de procesare, ci de cât de vie rămâne mierea: de
        enzimele, antioxidanții și polenul pe care le păstrează.
      </Lead>

      <H2>Ce este mierea crudă (raw honey)</H2>
      <P>
        Mierea crudă este miere neîncălzită și neprelucrată, extrasă la rece direct din fagure prin
        centrifugare. Nu este pasteurizată, nu este filtrată la presiune înaltă și nu i se adaugă nimic.
        Practic, ajunge în borcan aproape așa cum o lasă albinele — cu enzime active, polen, urme de
        propolis și toți compușii naturali intacți.
      </P>

      <H2>Ce este mierea pasteurizată</H2>
      <P>
        Mierea pasteurizată este încălzită la temperaturi ridicate (adesea 60–70°C) și filtrată fin, pentru
        a întârzia cristalizarea și a obține un aspect limpede, „comercial". Problema este că această căldură
        distruge enzimele și o parte dintre antioxidanți, transformând mierea într-un simplu îndulcitor.
      </P>

      <H2>Diferențele cheie</H2>
      <UL>
        <li><strong>Enzime:</strong> prezente în mierea crudă, distruse de pasteurizare.</li>
        <li><strong>Polen:</strong> păstrat în raw honey, eliminat prin filtrarea industrială.</li>
        <li><strong>Antioxidanți și flavonoide:</strong> mult mai bine conservați în mierea neîncălzită.</li>
        <li><strong>Cristalizare:</strong> mierea crudă cristalizează natural; cea pasteurizată rămâne lichidă artificial mai mult timp.</li>
        <li><strong>Gust:</strong> mierea crudă are aromă florală complexă; cea pasteurizată e mai „plată".</li>
      </UL>

      <ShopCTA>
        Toată mierea Fagurul de Aur este miere crudă, neîncălzită, extrasă la rece — de la salcâm la munte.
      </ShopCTA>

      <H2>De ce contează extracția la rece</H2>
      <P>
        Într-o stupină care practică o apicultură responsabilă, mierea se extrage prin centrifugare la rece,
        fără a fi încălzită. Așa rămân active diastaza și invertaza — enzimele care fac mierea un aliment viu.
        La <A href="/despre-noi">Fagurul de Aur</A>, recoltăm manual și extragem la rece fiecare lot, fără
        antibiotice și fără aditivi.
      </P>

      <H2>Cum alegi corect</H2>
      <P>
        Caută pe etichetă mențiuni precum „miere crudă", „neîncălzită" sau „extracție la rece" și un
        producător de încredere. Dacă mierea s-a zaharisit în borcan, e un semn bun de autenticitate — nu un
        defect. Vezi și ghidul nostru despre{" "}
        <A href="/blog/cum-recunosti-mierea-naturala">cum recunoști mierea naturală pură</A> și{" "}
        <A href="/magazin/miere-salcam">mierea de salcâm cu cristalizare lentă</A>.
      </P>
    </>
  );
}

function CumRecunostiMiereaNaturala() {
  return (
    <>
      <Lead>
        Piața este plină de mieri „cu zahăr" sau diluate cu sirop. Vestea bună: cu câteva verificări simple
        poți recunoaște mierea naturală pură, fără aditivi, de cea falsificată. Iată 7 semne sigure.
      </Lead>

      <H2>1. Cristalizarea naturală</H2>
      <P>
        Mierea naturală cristalizează în timp — unele soiuri mai repede (tei, polifloră), altele mai lent
        (salcâm). O miere care rămâne perfect lichidă luni întregi, indiferent de temperatură, a fost
        probabil încălzită sau falsificată. Detaliem fenomenul în articolul despre{" "}
        <A href="/blog/de-ce-cristalizeaza-mierea">de ce cristalizează mierea</A>.
      </P>

      <H2>2. Vâscozitatea</H2>
      <P>
        Înclină borcanul: mierea naturală curge lent, în fir continuu și gros. Mierea diluată cu sirop curge
        repede, apos, și formează bule care dispar greu.
      </P>

      <H2>3. Testul cu apă</H2>
      <P>
        Pune o linguriță de miere într-un pahar cu apă rece. Mierea pură se așază la fund într-o masă
        compactă și se dizolvă greu; cea falsificată se dispersează rapid în apă.
      </P>

      <H2>4. Aroma și gustul</H2>
      <P>
        Mierea autentică are o aromă florală caracteristică soiului — mentolată la tei, delicată la salcâm,
        puternică și rășinoasă la munte. Mierea cu zahăr are un gust „plat", doar dulce, fără profil aromatic.
      </P>

      <H2>5. Eticheta și proveniența</H2>
      <P>
        Caută originea florală, locul de recoltare și producătorul. Mențiunile „amestec de mieri din UE și
        non-UE" sunt un semnal de atenție. O <strong>miere bio</strong> autentică vine de la o stupină
        identificabilă, cu factură fiscală pentru fiecare comandă.
      </P>

      <H2>6. Comportamentul la cald</H2>
      <P>
        Mierea naturală caramelizează ușor și nu face spumă când e încălzită delicat. Atenție însă: nu o
        încălzi pentru consum — căldura îi distruge enzimele. Acest test e doar pentru verificare.
      </P>

      <H2>7. Polenul și „tulbureala"</H2>
      <P>
        O ușoară opacitate sau prezența polenului fin sunt semne că mierea este crudă și nefiltrată
        industrial. Mierea perfect transparentă, „ca apa", a fost adesea ultrafiltrată și pasteurizată — vezi
        diferențele în articolul <A href="/blog/miere-cruda-vs-pasteurizata">miere crudă vs pasteurizată</A>.
      </P>

      <ShopCTA>
        La Fagurul de Aur garantăm puritatea fiecărui borcan: miere recoltată manual, fără aditivi, cu
        proveniență clară din stupina noastră din Gorj.
      </ShopCTA>

      <H2>Pe scurt</H2>
      <P>
        O miere naturală pură cristalizează, curge gros, are aromă specifică și o proveniență transparentă.
        Descoperă mierea noastră de <A href="/magazin/miere-tei">tei</A>,{" "}
        <A href="/magazin/miere-salcam">salcâm</A> și <A href="/magazin/miere-munte">munte</A> în{" "}
        <A href="/magazin">magazinul Fagurul de Aur</A>.
      </P>
    </>
  );
}

function DeCeCristalizeazaMierea() {
  return (
    <>
      <Lead>
        Mulți cumpărători cred că mierea „zaharisită" este stricată sau falsificată. În realitate, este exact
        invers: cristalizarea este unul dintre cele mai clare semne că ai în față o miere naturală, pură.
      </Lead>

      <H2>De ce cristalizează mierea</H2>
      <P>
        Mierea este o soluție suprasaturată de zaharuri — în principal glucoză și fructoză. În timp, glucoza
        se separă din soluție și formează cristale fine, iar mierea trece din stare lichidă în stare cremoasă
        sau solidă. Este un proces fizic, natural și complet reversibil.
      </P>

      <H2>De ce unele soiuri cristalizează mai repede</H2>
      <P>
        Viteza cristalizării depinde de raportul glucoză/fructoză al fiecărui soi:
      </P>
      <UL>
        <li><strong>Cristalizare lentă:</strong> <A href="/magazin/miere-salcam">mierea de salcâm</A>, bogată în fructoză, rămâne lichidă mult timp.</li>
        <li><strong>Cristalizare medie spre rapidă:</strong> <A href="/magazin/miere-tei">mierea de tei</A> și mierea polifloră se zaharisesc mai repede, devenind cremoase.</li>
        <li><strong>Cristalizare grosieră:</strong> <A href="/magazin/miere-munte">mierea de munte</A> formează adesea cristale mari, caracteristice.</li>
      </UL>

      <H2>Cristalizarea = autenticitate</H2>
      <P>
        O miere care nu cristalizează niciodată a fost, de regulă, pasteurizată (încălzită) sau falsificată cu
        sirop. Mierea crudă, neîncălzită, își păstrează glucoza activă și, prin urmare, cristalizează natural.
        Mai multe despre diferențe găsești în articolul{" "}
        <A href="/blog/miere-cruda-vs-pasteurizata">miere crudă vs pasteurizată</A>.
      </P>

      <ShopCTA>
        Mierea Fagurul de Aur cristalizează natural — dovada că este crudă, pură și neprelucrată.
      </ShopCTA>

      <H2>Cum readuci mierea la consistență lichidă</H2>
      <OL>
        <li>Pune borcanul (deschis sau bine închis) într-un vas cu apă caldă, sub 40°C.</li>
        <li>Lasă-l 15–20 de minute și amestecă ușor cu o linguriță de lemn.</li>
        <li>Nu folosi cuptorul cu microunde și nu depăși 40°C — altfel distrugi enzimele și antioxidanții.</li>
      </OL>
      <P>
        Important: cristalizarea nu afectează valoarea nutritivă a mierii. Mulți preferă chiar mierea
        cristalizată, cremoasă, pentru tartine. Vezi întreaga gamă în{" "}
        <A href="/magazin">magazinul nostru</A> și alege soiul potrivit gusturilor tale.
      </P>
    </>
  );
}

export const articles: Record<string, () => ReactNode> = {
  "beneficii-miere-poliflora": BeneficiiMierePoliflora,
  "miere-cruda-vs-pasteurizata": MiereCrudaVsPasteurizata,
  "cum-recunosti-mierea-naturala": CumRecunostiMiereaNaturala,
  "de-ce-cristalizeaza-mierea": DeCeCristalizeazaMierea,
};
