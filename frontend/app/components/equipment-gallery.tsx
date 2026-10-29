import { ChevronDown } from "lucide-react";
import { equipmentGroups } from "@/lib/equipment";
import { EquipmentPhoto } from "./equipment-photo";

function EquipmentItems({ group }: { group: (typeof equipmentGroups)[number] }) {
  return (
    <div className="equipment-grid">
      {group.items.map((item) => (
        <figure key={item.slug}>
          <EquipmentPhoto
            {...item}
            sizes="(max-width: 760px) 85vw, (max-width: 1200px) 36vw, 320px"
          />
          <figcaption>
            <h4>{item.name}</h4>
            <p>{item.description}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function EquipmentGallery({ collapsible = false }: { collapsible?: boolean }) {
  return (
    <div className="equipment-groups">
      {equipmentGroups.map((group, index) =>
        collapsible ? (
          <details className="equipment-disclosure" key={group.id} open={index === 0}>
            <summary>
              <h3 id={`equipment-${group.id}`}>
                <span>{group.title}</span>
                <span className="equipment-summary-meta">
                  {group.items.length} tools
                  <ChevronDown size={18} aria-hidden="true" />
                </span>
              </h3>
            </summary>
            <div className="equipment-disclosure-content">
              <p className="equipment-group-description">{group.description}</p>
              <EquipmentItems group={group} />
            </div>
          </details>
        ) : (
          <section
            className="equipment-group"
            key={group.id}
            aria-labelledby={`equipment-${group.id}`}
          >
            <div className="section-heading">
              <h3 id={`equipment-${group.id}`}>{group.title}</h3>
              <p>{group.description}</p>
            </div>
            <div className="equipment-grid">
              {group.items.map((item) => (
                <figure key={item.slug}>
                  <EquipmentPhoto
                    {...item}
                    sizes="(max-width: 520px) 90vw, (max-width: 900px) 44vw, 280px"
                  />
                  <figcaption>
                    <h4>{item.name}</h4>
                    <p>{item.description}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
