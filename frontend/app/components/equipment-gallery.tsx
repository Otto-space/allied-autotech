import Image from "next/image";
import { equipmentGroups } from "@/lib/equipment";

export function EquipmentGallery() {
  return (
    <div className="equipment-groups">
      {equipmentGroups.map((group) => (
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
                <div className="equipment-image">
                  <Image
                    src={`/images/equipment/${item.slug}.jpg`}
                    alt={item.name}
                    fill
                    sizes="(max-width: 520px) 90vw, (max-width: 900px) 44vw, 280px"
                  />
                </div>
                <figcaption>
                  <h4>{item.name}</h4>
                  <p>{item.description}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
