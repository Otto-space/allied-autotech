import type { Metadata } from "next";
import Link from "next/link";
import { business } from "@/lib/business";
import { publicMetadata } from "@/lib/seo";
import { catalogueOnly } from "@/lib/public-launch";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import "./privacy.css";

export const metadata: Metadata = publicMetadata(
  "Privacy notice",
  "How Allied Autotech Limited handles your information, privacy choices and requests.",
  "/privacy",
);

export default function PrivacyPage() {
  const catalogue = catalogueOnly();
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site privacy-notice">
        <nav aria-label="Breadcrumb">
          <Link href="/">Home</Link> / Privacy
        </nav>
        <h1>Privacy notice</h1>
        <p className="privacy-version">
          {catalogue
            ? "Catalogue release · Version 1"
            : "Accounts and enquiries · Version 2"}{" "}
          · Effective 22 October 2026
        </p>
        <p>
          Allied Autotech Limited is responsible for the customer information described
          here. You can reach us at{" "}
          <a href={`mailto:${business.email}`}>{business.email}</a>,{" "}
          <a href={business.whatsapp} target="_blank" rel="noopener noreferrer">
            Whatsapp
          </a>
          , or {business.address}.
        </p>
        <h2>What this website offers</h2>
        <p>
          {catalogue
            ? "You can browse services, products, vehicles and approved customer reviews, and contact us by phone, email or WhatsApp. Website enquiry forms, customer registration, checkout and paid reservations are currently unavailable. Staff access is restricted."
            : "You can browse the catalogue, create an account, save information to your profile and garage, and send enquiries, complaints and requests for service visits or vehicle inspections. Staff must confirm availability and arrangements. Submitting a request does not place an order, reserve a vehicle or guarantee an appointment. Online checkout, paid reservations and payment collection are unavailable in this release."}
        </p>
        <h2>Information we use and why</h2>
        <p>
          Our website and hosting providers process technical information such as your IP
          address, requested pages, browser details, request times and errors to deliver
          and secure the website. We rely on our legitimate interests in operating a
          reliable website and preventing misuse, balanced against your privacy rights.
        </p>
        <p>
          If you contact us, we use the contact details, message, vehicle information and
          other details you choose to provide to answer and manage your request. Where you
          ask us to arrange a service or purchase, this may involve steps at your request
          before a contract. Otherwise, we rely on our legitimate interests in responding
          to enquiries and handling complaints. We do not use enquiry details for
          marketing.
        </p>
        <p>
          Please avoid sending passwords, payment security codes or unnecessary identity
          documents. If information is needed to handle your request, we will explain what
          is required. We do not make solely automated decisions about accepting a vehicle
          purchase or granting credit through this release.
        </p>
        {!catalogue && (
          <>
            <h2>Accounts, forms and reviews</h2>
            <p>
              Registration uses your name, email, phone number and securely hashed
              password. We also keep verification, sign-in and security records. Optional
              profile information, addresses, profile photos, garage details and vehicle
              images support the account features you choose to use. Enquiries and
              complaints include your contact details, message, related listing or branch,
              preferred visit time where supplied, correspondence and handling history.
            </p>
            <p>
              We use these details to provide requested account services, respond to
              requests, send essential account and support messages, and protect the
              service. We rely on performance of requested services or steps you request
              before a contract where applicable, and legitimate interests in support and
              security, balanced against your rights. Optional fields may be left blank.
              Registration is not marketing consent. Submitted reviews require moderation;
              approved review text, ratings, your profile first and last name and current
              profile photo (if added) can appear on the website. Changing or removing
              your profile photo updates the portrait available through approved reviews.
            </p>
          </>
        )}
        <h2>Who receives information</h2>
        <p>
          Authorised staff and our authorised technical administrator access information
          as needed for their work. We use website hosting, cloud storage and email
          service providers to operate the website and communications. Their necessary
          service providers may also process information. We may disclose information
          where required by law or necessary to establish or defend legal claims.
        </p>
        <p>
          Processing can take place outside Nigeria, including the United Kingdom and
          United States. Provider agreements, access controls and security measures form
          part of our safeguards. Contact us for information about the arrangements
          relevant to your information; we do not promise that all processing stays in
          Nigeria or London.
        </p>
        <h2>Links, cookies and your browser</h2>
        <p>
          WhatsApp, email and map links open the service you choose. That service&apos;s
          own privacy terms also apply. This website does not use advertising or analytics
          cookies. Essential session and security cookies support sign-in and protected
          functions. Catalogue searches and filters may appear in page addresses and
          technical logs; do not enter confidential information in search fields.
        </p>
        {!catalogue && (
          <p>
            Selected forms keep drafts in this browser&apos;s session storage to preserve
            entered text during navigation or reloads. Drafts may contain contact details
            and messages; password, file-upload and recognised security-token fields are
            excluded. Successful submission clears the corresponding unchanged draft, and
            signing out clears account drafts. Browser settings and session restoration
            can affect how long drafts remain. Clear site data when using a shared device.
          </p>
        )}
        <h2>How long we keep information</h2>
        {!catalogue && (
          <p>
            Account and related profile or garage information is kept while needed for
            your active account and services. After 24 months without customer activity,
            company staff review the account for closure and give 30 days&apos; notice to
            sign in or request that it remain open. Staff updates and background emails do
            not count as customer activity. Closure and removal require company action;
            they are not automatic. Necessary records for unresolved matters or legal
            obligations follow their applicable rules. You may request deletion sooner.
          </p>
        )}
        <p>
          Ordinary enquiries that close without a sale, booking or complaint are kept for
          12 months after closure. Ordinary complaints are kept for 24 months after final
          closure. Routine security events are kept for 12 months and ordinary records of
          staff actions for 24 months after the event. Provider technical logs and
          recovery copies have their own, sometimes shorter, expiry schedules.
        </p>
        <p>
          Company staff authorise removal of company-controlled records. Provider-managed
          expiry and recovery rotation can occur automatically. Temporary working copies
          are reviewed for removal within seven days after the task is completed. Minimal
          records of completed privacy requests are kept for 24 months after final
          closure.
        </p>
        <p>
          Information needed for an unresolved serious incident, dispute, legal obligation
          or claim may be kept longer under a documented hold. The owner reviews holds at
          least every 90 days, or sooner when circumstances change. Backup copies may
          remain until their recovery cycle ends; deletion is not instantaneous across
          every system.
        </p>
        <h2>Your requests and complaints</h2>
        <p>
          Contact <a href={`mailto:${business.email}`}>{business.email}</a> to request
          access, correction, deletion, restriction or portability, or to object to
          processing where applicable. Newworld Orlu, our Operations Supervisor,
          coordinates requests. We may need proportionate identity verification. Some
          information may need to be retained for legal obligations or claims; we will
          explain relevant limits.
        </p>
        <p>
          You can also complain directly to the{" "}
          <a href="https://ndpc.gov.ng/" target="_blank" rel="noreferrer">
            Nigeria Data Protection Commission
          </a>
          . We will update this notice when our services or practices change.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
