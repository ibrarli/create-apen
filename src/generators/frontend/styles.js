// Style specs per component: Tailwind classes + equivalent plain CSS.
// The starter UI uses the Apen Apps accent colors (#00aeef → #f15a29).
export const STYLES = {
  button: {
    root: {
      tw: "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00aeef] to-[#f15a29] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
      css: `display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border: 0;
        border-radius: 0.75rem;
        background: linear-gradient(90deg, #00aeef, #f15a29);
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: #fff;
        cursor: pointer;
        transition: opacity 0.15s;`,
    },
  },
  header: {
    root: { tw: "border-b border-neutral-200 bg-white/80 backdrop-blur", css: "border-bottom: 1px solid #e5e5e5;\nbackground: rgba(255, 255, 255, 0.8);" },
    inner: {
      tw: "mx-auto flex max-w-5xl items-center justify-between px-6 py-4",
      css: "max-width: 64rem;\nmargin: 0 auto;\ndisplay: flex;\nalign-items: center;\njustify-content: space-between;\npadding: 1rem 1.5rem;",
    },
    logo: { tw: "text-lg font-extrabold tracking-tight", css: "font-size: 1.125rem;\nfont-weight: 800;\nletter-spacing: -0.01em;" },
    tagline: { tw: "text-xs text-neutral-500", css: "font-size: 0.75rem;\ncolor: #737373;" },
  },
  mainLayout: {
    root: { tw: "min-h-screen bg-neutral-50 text-neutral-900", css: "min-height: 100vh;\nbackground: #fafafa;\ncolor: #171717;" },
    main: { tw: "mx-auto max-w-5xl px-6 py-12", css: "max-width: 64rem;\nmargin: 0 auto;\npadding: 3rem 1.5rem;" },
  },
  userCard: {
    root: {
      tw: "w-full cursor-pointer rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md",
      css: "width: 100%;\ncursor: pointer;\nborder: 1px solid #e5e5e5;\nborder-radius: 1rem;\nbackground: #fff;\npadding: 1rem;\ntext-align: left;\nfont: inherit;\ntransition: box-shadow 0.15s;",
    },
    selected: { tw: "border-transparent ring-2 ring-[#f15a29]", css: "border-color: transparent;\nbox-shadow: 0 0 0 2px #f15a29;" },
    name: { tw: "font-semibold", css: "display: block;\nfont-weight: 600;" },
    email: { tw: "text-sm text-neutral-500", css: "display: block;\nfont-size: 0.875rem;\ncolor: #737373;" },
  },
  userList: {
    root: { tw: "space-y-4", css: "display: grid;\ngap: 1rem;" },
    toolbar: { tw: "flex items-center justify-between", css: "display: flex;\nalign-items: center;\njustify-content: space-between;" },
    title: { tw: "text-lg font-semibold", css: "margin: 0;\nfont-size: 1.125rem;\nfont-weight: 600;" },
    grid: { tw: "grid gap-3 sm:grid-cols-2", css: "display: grid;\ngap: 0.75rem;\ngrid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));" },
    empty: {
      tw: "rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500",
      css: "border: 1px dashed #d4d4d4;\nborder-radius: 1rem;\npadding: 1.5rem;\ntext-align: center;\nfont-size: 0.875rem;\ncolor: #737373;",
    },
    error: {
      tw: "rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700",
      css: "border: 1px solid #fecaca;\nborder-radius: 1rem;\nbackground: #fef2f2;\npadding: 1rem;\nfont-size: 0.875rem;\ncolor: #b91c1c;",
    },
  },
  homePage: {
    hero: { tw: "mb-12 space-y-4", css: "margin-bottom: 3rem;\ndisplay: grid;\ngap: 1rem;" },
    eyebrow: {
      tw: "text-xs font-bold uppercase tracking-widest text-[#f15a29]",
      css: "margin: 0;\nfont-size: 0.75rem;\nfont-weight: 700;\ntext-transform: uppercase;\nletter-spacing: 0.1em;\ncolor: #f15a29;",
    },
    title: { tw: "text-4xl font-extrabold tracking-tight", css: "margin: 0;\nfont-size: 2.25rem;\nfont-weight: 800;\nletter-spacing: -0.02em;" },
    lead: { tw: "max-w-2xl text-neutral-600", css: "margin: 0;\nmax-width: 42rem;\ncolor: #525252;" },
    chips: { tw: "flex flex-wrap gap-2", css: "display: flex;\nflex-wrap: wrap;\ngap: 0.5rem;" },
    chip: {
      tw: "rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium",
      css: "border: 1px solid #e5e5e5;\nborder-radius: 999px;\nbackground: #fff;\npadding: 0.25rem 0.75rem;\nfont-size: 0.75rem;\nfont-weight: 500;",
    },
  },
  notFoundPage: {
    root: { tw: "space-y-4 py-24 text-center", css: "display: grid;\ngap: 1rem;\npadding: 6rem 0;\ntext-align: center;\njustify-items: center;" },
    code: { tw: "text-6xl font-extrabold text-[#00aeef]", css: "margin: 0;\nfont-size: 3.75rem;\nfont-weight: 800;\ncolor: #00aeef;" },
    text: { tw: "text-neutral-600", css: "margin: 0;\ncolor: #525252;" },
  },
};

export const BASE_CSS = `*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}`;
