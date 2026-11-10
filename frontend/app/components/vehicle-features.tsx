import styles from "./vehicle-features.module.css";

export function VehicleFeatures({ features }: { features?: readonly string[] }) {
  if (!features?.length) return null;
  return (
    <section aria-label="Additional features">
      <h3>Additional features</h3>
      <ul className={styles.list}>
        {features.map((feature, index) => (
          <li key={index}>{feature}</li>
        ))}
      </ul>
    </section>
  );
}
