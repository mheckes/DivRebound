// Links von der App zurück auf die Website. Eine Quelle für beide Seiten:
// site/_data/nav.json (daraus rendert Eleventy auch Header und Footer der
// Website). Die URLs dort sind relativ zur Website-Wurzel ("/impressum/").
import nav from "../../../site/_data/nav.json";

// BASE_URL = "/DivRebound/app/" -> Website-Wurzel "/DivRebound/"
const siteRoot = import.meta.env.BASE_URL.replace(/app\/$/, "");

const toSite = (url) => siteRoot + url.replace(/^\//, "");

export const websiteHome = toSite("/");

// Fuß der Seitenleiste: Über mich · Impressum · Datenschutz
const order = ["/ueber-mich/", "/impressum/", "/datenschutz/"];
export const legalLinks = order
  .map((url) => nav.footer.find((item) => item.url === url))
  .filter(Boolean)
  .map((item) => ({ title: item.title, href: toSite(item.url) }));
