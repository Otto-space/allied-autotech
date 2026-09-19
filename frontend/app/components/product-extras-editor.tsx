"use client";
import { useEffect, useRef, useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import {
  parseProductExtrasPage,
  productExtrasRevision,
  type ProductCompatibility,
  type ProductImage,
} from "@/lib/api/product-extras-schemas";
import {
  checkProductExtras,
  saveProductCompatibility,
  saveProductImage,
  removeProductExtra,
} from "@/lib/api/product-extras-actions";
import { isPublicMediaUrl, publicMediaHosts } from "@/lib/media";
import { PublicMedia } from "./public-media";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { ProductCompatibilityForm } from "./product-compatibility-form";
import { ProductImageForm } from "./product-image-form";
type Editor = (
  | { kind: "compatibility"; item: ProductCompatibility | null }
  | { kind: "image"; item: ProductImage | null }
) & { revision: string };
const hosts = publicMediaHosts(process.env.NEXT_PUBLIC_MEDIA_HOSTS);
export function ProductExtrasEditor({
  productId,
  sourcePath,
  uncertain,
  onUncertain,
  onUpdated,
  onClose,
}: {
  productId: string;
  sourcePath: string;
  uncertain: boolean;
  onUncertain: () => void;
  onUpdated: () => void;
  onClose: () => void;
}) {
  const records = useResource(sourcePath, parseProductExtrasPage);
  const product = records.data?.items.find((item) => item.id === productId);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const disabled = records.loading || !!records.error || !product || uncertain;
  const changed =
    !!editor && (!product || productExtrasRevision(product) !== editor.revision);
  function review(next: MutationProposal) {
    if (disabled || proposal || !product) return;
    const expected = product;
    setMessage(undefined);
    setProposal({
      ...next,
      facts: [
        { label: "Part", value: `${product.name} (${product.sku})` },
        ...next.facts,
      ],
      onUncertain,
      submit: async () => {
        try {
          await checkProductExtras(sourcePath, expected);
          await next.submit();
        } finally {
          records.refresh();
          onUpdated();
        }
      },
    });
  }
  function reloadEditor() {
    if (!product || !editor) return;
    if (editor.kind === "compatibility") {
      const item = editor.item
        ? product.compatibilities.find((item) => item.id === editor.item?.id)
        : null;
      if (item === undefined) {
        setEditor(null);
        setMessage("That compatibility record is no longer available.");
        return;
      }
      setEditor({
        kind: "compatibility",
        item,
        revision: productExtrasRevision(product),
      });
    } else {
      const item = editor.item
        ? product.images.find((item) => item.id === editor.item?.id)
        : null;
      if (item === undefined) {
        setEditor(null);
        setMessage("That image record is no longer available.");
        return;
      }
      setEditor({ kind: "image", item, revision: productExtrasRevision(product) });
    }
    setEpoch((value) => value + 1);
  }
  return (
    <section className="detail-section" aria-labelledby="product-extras-heading">
      <h2 id="product-extras-heading" ref={heading} tabIndex={-1}>
        Compatibility &amp; images{product ? ` · ${product.name}` : ""}
      </h2>
      <p>
        These records describe the selected part in the public catalogue when its product
        and category are active.
      </p>
      <Feedback message={records.error} />
      <Feedback message={message} tone="info" />
      {uncertain && (
        <p className="notice" role="status">
          The previous change could not be confirmed. Refresh and reconcile this part’s
          records before making another change. These controls will not resend it.
        </p>
      )}
      <div className="actions">
        <button
          className="button secondary"
          disabled={records.loading || !!proposal}
          onClick={records.refresh}
        >
          Refresh compatibility &amp; images
        </button>
        <button className="button secondary" disabled={!!proposal} onClick={onClose}>
          Close compatibility &amp; images
        </button>
      </div>
      {records.loading && <p role="status">Checking the selected part…</p>}
      {!records.loading && !records.error && !product && (
        <p className="notice">
          This part is no longer on the selected catalogue page. Refresh the catalogue,
          find the part and open its records again.
        </p>
      )}
      {product && (
        <>
          {(!product.isActive || !product.category.isActive) && (
            <p className="notice">
              This part is not publicly listed while it or its category is inactive.
            </p>
          )}
          <div className="actions">
            <button
              className="button secondary"
              disabled={disabled || !!editor}
              onClick={() => {
                setEditor({
                  kind: "compatibility",
                  item: null,
                  revision: productExtrasRevision(product),
                });
                setEpoch((value) => value + 1);
              }}
            >
              Add compatibility
            </button>
            <button
              className="button secondary"
              disabled={disabled || !!editor}
              onClick={() => {
                setEditor({
                  kind: "image",
                  item: null,
                  revision: productExtrasRevision(product),
                });
                setEpoch((value) => value + 1);
              }}
            >
              Add product image
            </button>
          </div>
        </>
      )}
      {changed && !uncertain && (
        <div className="notice">
          <p>
            The product records changed. Your draft is preserved. Review the refreshed
            records before reloading the editor.
          </p>
          <button className="button secondary" disabled={disabled} onClick={reloadEditor}>
            Reload product editor
          </button>
        </div>
      )}
      {editor?.kind === "compatibility" && (
        <ProductCompatibilityForm
          key={epoch}
          item={editor.item}
          disabled={disabled || changed}
          onCancel={() => setEditor(null)}
          onReview={(value) =>
            review({
              title: editor.item
                ? "Review compatibility update"
                : "Review new compatibility",
              description:
                "These fitment details can appear to customers and affect vehicle compatibility searches.",
              facts: [
                { label: "Make", value: value.make },
                { label: "Model", value: value.model || "Not specified" },
                { label: "First year", value: value.yearFrom || "Not specified" },
                { label: "Final year", value: value.yearTo || "Not specified" },
                { label: "Notes", value: value.notes || "Not recorded" },
              ],
              submit: () => saveProductCompatibility(productId, editor.item?.id, value),
            })
          }
        />
      )}
      {editor?.kind === "image" && (
        <ProductImageForm
          key={epoch}
          item={editor.item}
          disabled={disabled || changed}
          onCancel={() => setEditor(null)}
          onReview={(value) =>
            review({
              title: editor.item
                ? "Review product image update"
                : "Review new product image",
              description: `This image record can appear in the public catalogue. ${value.isPrimary ? "It will replace the existing primary image selection." : "It will not be designated primary; clearing an existing primary does not select a replacement."}`,
              facts: [
                { label: "Public URL", value: value.url },
                {
                  label: "Image description",
                  value: value.altText || "Product name used as fallback",
                },
                { label: "Sort position", value: value.sortOrder },
                { label: "Primary", value: value.isPrimary ? "Yes" : "No" },
                {
                  label: "Display host",
                  value: isPublicMediaUrl(value.url, hosts)
                    ? "Approved by this site"
                    : "Not approved; image display unavailable",
                },
              ],
              submit: () => saveProductImage(productId, editor.item?.id, value),
            })
          }
        />
      )}
      {product && (
        <>
          <section className="detail-section">
            <h3>Recorded compatibility</h3>
            {product.compatibilities.length === 0 && (
              <p>No compatibility records are saved for this part.</p>
            )}
            {product.compatibilities.map((item) => (
              <article className="detail-section" key={item.id}>
                <h4>
                  {item.make}
                  {item.model ? ` · ${item.model}` : " · model not specified"}
                </h4>
                <p>
                  First year: {item.yearFrom ?? "not specified"} · Final year:{" "}
                  {item.yearTo ?? "not specified"}
                </p>
                <p>{item.notes ?? "No fitment notes recorded."}</p>
                <div className="actions">
                  <button
                    className="button secondary"
                    disabled={disabled || !!editor}
                    onClick={() => {
                      setEditor({
                        kind: "compatibility",
                        item,
                        revision: productExtrasRevision(product),
                      });
                      setEpoch((value) => value + 1);
                    }}
                  >
                    Edit compatibility for {item.make}
                    {item.model ? ` ${item.model}` : ""}
                  </button>
                  <button
                    className="button secondary"
                    disabled={disabled || !!editor}
                    onClick={() =>
                      review({
                        title: "Remove compatibility record?",
                        description:
                          "This removes the saved fitment record and its match in catalogue searches. There is no undo action; adding it again creates a new record.",
                        facts: [
                          {
                            label: "Make / model",
                            value: `${item.make} / ${item.model ?? "not specified"}`,
                          },
                          {
                            label: "Year range",
                            value: `${item.yearFrom ?? "not specified"} – ${item.yearTo ?? "not specified"}`,
                          },
                          { label: "Record reference", value: item.id },
                        ],
                        submit: () =>
                          removeProductExtra(productId, "compatibilities", item.id),
                      })
                    }
                  >
                    Remove compatibility for {item.make}
                    {item.model ? ` ${item.model}` : ""}
                  </button>
                </div>
              </article>
            ))}
          </section>
          <section className="detail-section">
            <h3>Recorded product images</h3>
            {product.images.length === 0 && <p>No product images are saved.</p>}
            <div className="record-grid">
              {product.images.map((item, index) => (
                <article className="detail-section" key={item.id}>
                  <h4>
                    Image {index + 1}
                    {item.isPrimary ? " · primary" : ""}
                  </h4>
                  <PublicMedia
                    key={item.url}
                    src={item.url}
                    alt={item.altText ?? product.name}
                  />
                  <p>
                    {item.altText ??
                      "No image description recorded; the product name is used."}
                  </p>
                  <p>Sort position: {item.sortOrder}</p>
                  <p className="preserve-lines">{item.url}</p>
                  {!isPublicMediaUrl(item.url, hosts) && (
                    <p className="notice">
                      The image host is not approved for display by this site.
                    </p>
                  )}
                  <div className="actions">
                    <button
                      className="button secondary"
                      disabled={disabled || !!editor}
                      onClick={() => {
                        setEditor({
                          kind: "image",
                          item,
                          revision: productExtrasRevision(product),
                        });
                        setEpoch((value) => value + 1);
                      }}
                    >
                      Edit image {index + 1}
                    </button>
                    <button
                      className="button secondary"
                      disabled={disabled || !!editor}
                      onClick={() =>
                        review({
                          title: "Remove product image?",
                          description: `This removes the image from this product. It does not delete the hosted file.${item.isPrimary ? " No replacement primary image will be selected automatically." : ""}`,
                          facts: [
                            { label: "Image URL", value: item.url },
                            {
                              label: "Description",
                              value: item.altText ?? "Not recorded",
                            },
                            { label: "Primary", value: item.isPrimary ? "Yes" : "No" },
                          ],
                          submit: () => removeProductExtra(productId, "images", item.id),
                        })
                      }
                    >
                      Remove image {index + 1}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
          }}
          onSuccess={() => {
            setEditor(null);
            setMessage(
              "Product record change confirmed. Review the refreshed catalogue details.",
            );
          }}
        />
      )}
    </section>
  );
}
