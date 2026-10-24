// Body of privacy-policy.html (banner + policy text). Used by tools/build-pages.js. Every text block becomes an editable CMS text on the live page.
// The wording follows the Industrial Fabrics privacy policy; it describes what THIS website really does (see js/rg-consent.js, js/rg-cache.js, js/site.js forms).
const UPDATED = 'October 25, 2026';

module.exports = function privacyBody() {
  return `
  <section class="rg-75">
    <img src="images/img_p19_1.webp" alt class="rg-63">
    <div class="rg-16"></div>
    <div class="rg-76">
      <h1 class="rg-154">Privacy Policy</h1>
      <div class="rg-78"><button data-href="index.html" class="rg-169 pp-home">Home</button> / <span>Privacy Policy</span></div>
    </div>
  </section>
  <section class="rg-79">
    <div class="pp-wrap">
      <p class="pp-updated">Last updated: ${UPDATED}</p>
      <p>This website is operated by Industrial Fabrics, Inc. for the ROADGLAS® asphalt reinforcement products. This policy explains what information the website collects, which cookies and browser storage it uses, and the choices you have.</p>

      <h2 id="cookies">1. Cookies We Use</h2>
      <p>We use one first-party cookie, set only when a staff member logs into our content-management dashboard. Regular website visitors never receive this cookie.</p>
      <div class="pp-table"><table>
        <thead><tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr></thead>
        <tbody><tr><td>admin_token</td><td>Keeps an authorized staff member signed in to the content-management dashboard.</td><td>24 hours, or until logout</td></tr></tbody>
      </table></div>

      <h2>2. Browser Storage (Local/Session Storage)</h2>
      <p>In addition to cookies, we use your browser's local storage — data that stays on your device and is not sent to any third party — for the following purposes only:</p>
      <ul>
        <li>Performance caching: a temporary copy of page content (kept for up to 24 hours) so pages you have already visited load instantly.</li>
        <li>Cookie preference: remembering whether you accepted or declined the cookie banner, so it does not reappear on every visit.</li>
        <li>Staff sign-in (staff only): letting our own staff know they are already logged in on the content dashboard.</li>
      </ul>
      <p>None of this browser storage contains your name, IP address, or any information that identifies you personally, and none of it is shared with third parties.</p>

      <h2>3. Third-Party Services &amp; Advertising</h2>
      <p>We do not use Google Analytics, Facebook Pixel, or advertising cookies on this website. We do use a third-party tracking tag provided by ZoomInfo (zoominfo.com), which may set cookies and collect your IP address, browser information and the pages you visit, to help us understand which businesses visit our website. This tag is only loaded if you choose &ldquo;Accept&rdquo; in the cookie banner. ZoomInfo handles this data under its own privacy notice.</p>
      <p>The website's fonts are loaded from Google Fonts (fonts.googleapis.com), so your browser's IP address is sent to Google when a page opens. No other personal information is shared with them by us.</p>

      <h2>4. Information You Submit to Us</h2>
      <p>When you use our Contact, Lunch &amp; Learn or Apply for Credit forms, the information you enter (such as your name, email, phone number, company, and message) is sent to our team so we can respond to your inquiry or process your request. It is not sold, and it is not shared with third parties for marketing purposes.</p>

      <h2 id="california">5. California Privacy Rights (CCPA/CPRA)</h2>
      <p>If you are a California resident, the California Consumer Privacy Act, as amended by the California Privacy Rights Act (CCPA/CPRA), gives you certain rights over personal information collected about you.</p>
      <p>Our ZoomInfo tracking tag (Section 3) may be considered a &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of personal information under the CCPA/CPRA. To opt out, choose &ldquo;Deny&rdquo; in the cookie banner or use the &ldquo;Cookie Preferences&rdquo; link in the footer, or email support@industrialfabrics.com.</p>
      <div class="pp-table"><table>
        <thead><tr><th>Category of Personal Information</th><th>Collected?</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td>Identifiers (name, email, phone, company)</td><td>Yes — only if you submit one of our forms</td><td>Responding to your inquiry or request</td></tr>
          <tr><td>Internet/network activity (cookies, browser storage)</td><td>Yes — limited to what is described in Sections 1–3</td><td>Site functionality, staff login, performance caching, ZoomInfo tag (if accepted)</td></tr>
          <tr><td>Precise geolocation, biometric, or financial account data</td><td>No</td><td>—</td></tr>
        </tbody>
      </table></div>
      <p>Subject to certain exceptions, California residents have the right to:</p>
      <ul>
        <li>Know what personal information we have collected about you and how it has been used;</li>
        <li>Delete personal information we have collected from you, subject to certain legal exceptions;</li>
        <li>Correct inaccurate personal information we maintain about you;</li>
        <li>Opt out of the sale or sharing of personal information (see above); and</li>
        <li>Not be discriminated against for exercising any of these rights.</li>
      </ul>
      <p>To submit a request to know, delete, or correct your information, please email support@industrialfabrics.com with the subject line &ldquo;California Privacy Request&rdquo;, or use our Contact page. We will need to verify your identity before completing your request, and will respond within the timeframe required by law.</p>

      <h2>6. Your Choices</h2>
      <p>You can accept or decline non-essential cookies using the banner shown on your first visit to this site, and change that choice at any time via the &ldquo;Cookie Preferences&rdquo; link in the footer. Most browsers also let you block or delete cookies and clear local storage through their own privacy settings.</p>

      <h2>7. Changes to This Policy</h2>
      <p>We may update this policy from time to time. The date at the top of this page shows when it was last changed.</p>

      <h2>8. Contact Us</h2>
      <p>If you have questions about this policy or how we handle information submitted through our website, please reach out through our Contact page or write to us:</p>
      <p class="pp-contact">Industrial Fabrics, Inc.<br>510 O'Neal Lane Ext., Baton Rouge, LA 70819<br>1-800-848-4500<br>support@industrialfabrics.com</p>
    </div>
  </section>`;
};
