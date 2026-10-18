import Script from "next/script";
import { getSettings, getNavigation } from "@/lib/data/settings";
import { getPrograms } from "@/lib/data/content";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { FloatingActions, AnnouncementBar } from "@/components/site/floating";
import { JsonLd, organizationJsonLd } from "@/lib/seo";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [settings, nav, programs] = await Promise.all([getSettings(), getNavigation(), getPrograms()]);
  return (
    <>
      <JsonLd data={organizationJsonLd(settings)} />
      {settings.announcement?.enabled && settings.announcement.text && (
        <AnnouncementBar text={settings.announcement.text} linkLabel={settings.announcement.link_label} linkUrl={settings.announcement.link_url} tone={settings.announcement.tone} />
      )}
      <SiteHeader nav={nav.header} settings={settings} programs={programs.map((p) => ({ code: p.code, slug: p.slug, name: p.name, qualification: p.qualification, duration: p.duration, logo_url: p.logo_url, accent: p.accent }))} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} footer={nav.footer} />
      <FloatingActions whatsapp={settings.whatsapp} message={settings.whatsapp_message} />
      {settings.analytics.ga4_id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${settings.analytics.ga4_id}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${settings.analytics.ga4_id}');window.addEventListener('icet:lead',e=>gtag('event','generate_lead',{type:e.detail&&e.detail.type}));`}</Script>
        </>
      )}
      {settings.analytics.gtm_id && (
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${settings.analytics.gtm_id}');`}</Script>
      )}
      {settings.analytics.fb_pixel_id && (
        <Script id="fbq" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${settings.analytics.fb_pixel_id}');fbq('track','PageView');window.addEventListener('icet:lead',()=>fbq('track','Lead'));`}</Script>
      )}
      {settings.analytics.clarity_id && (
        <Script id="clarity" strategy="afterInteractive">{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${settings.analytics.clarity_id}");`}</Script>
      )}
    </>
  );
}
