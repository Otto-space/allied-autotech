"use client";
import { useId, useState } from "react";
import type { Overview } from "@/lib/api/overview-schemas";

const shortDate = (date: string) =>
  new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(`${date}T12:00:00+01:00`));
export function OverviewActivity({ rows }: { readonly rows: Overview["activity"] }) {
  const id = useId();
  const [selected, setSelected] = useState(rows.length - 1);
  const [series, setSeries] = useState({ bookings: true, orders: true });
  const maximum = Math.max(
    4,
    ...rows.flatMap((row) => [
      series.bookings ? row.bookings : 0,
      series.orders ? row.orders : 0,
    ]),
  );
  const ceiling = Math.ceil(maximum / 4) * 4;
  const x = (index: number) => 44 + (index * 630) / Math.max(1, rows.length - 1);
  const y = (count: number) => 200 - (count * 168) / ceiling;
  const current = rows[Math.min(selected, rows.length - 1)];
  const total = rows.reduce((sum, row) => sum + row.bookings + row.orders, 0);
  return (
    <>
      <div className="overview-panel-heading">
        <div>
          <h2>Activity overview</h2>
          <p>New bookings and Shop orders · Lagos dates</p>
        </div>
        <div className="overview-legend" aria-label="Chart series">
          {(["bookings", "orders"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={series[key]}
              onClick={() => setSeries((value) => ({ ...value, [key]: !value[key] }))}
            >
              <span className={`chart-dot ${key}`} />
              {key === "bookings" ? "Bookings" : "Orders"}
            </button>
          ))}
        </div>
      </div>
      <div className="overview-chart">
        <svg
          viewBox="0 0 710 236"
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
        >
          <title id={`${id}-title`}>Daily bookings and orders</title>
          <desc id={`${id}-description`}>
            {total === 0
              ? "No new bookings or orders in this period."
              : `${total.toLocaleString("en-NG")} bookings and orders combined in this period.`}{" "}
            Use the day selector or open the daily data table for exact values.
          </desc>
          {[0, 1, 2, 3, 4].map((step) => (
            <g key={step}>
              <line
                x1="44"
                x2="674"
                y1={y((ceiling * step) / 4)}
                y2={y((ceiling * step) / 4)}
                stroke="#edf0f3"
              />
              <text x="34" y={y((ceiling * step) / 4) + 4} textAnchor="end">
                {(ceiling * step) / 4}
              </text>
            </g>
          ))}
          <line
            x1={x(selected)}
            x2={x(selected)}
            y1="25"
            y2="204"
            stroke="#d9dee7"
            strokeDasharray="4 4"
          />
          {(["bookings", "orders"] as const)
            .filter((key) => series[key])
            .map((key) => (
              <g key={key} className={`overview-series ${key}`}>
                <polyline
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={rows
                    .map((row, index) => `${x(index)},${y(row[key])}`)
                    .join(" ")}
                />
                <circle cx={x(selected)} cy={y(current[key])} r="4" />
              </g>
            ))}
          {[...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].map(
            (index) => (
              <text
                key={index}
                x={x(index)}
                y="228"
                textAnchor={
                  index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"
                }
              >
                {shortDate(rows[index].date)}
              </text>
            ),
          )}
          {rows.map((row, index) => (
            <rect
              key={row.date}
              x={x(index) - 630 / Math.max(1, rows.length - 1) / 2}
              y="20"
              width={630 / Math.max(1, rows.length - 1)}
              height="188"
              fill="transparent"
              aria-hidden="true"
              onPointerEnter={() => setSelected(index)}
              onClick={() => setSelected(index)}
            />
          ))}
        </svg>
        <output className="overview-chart-tooltip" aria-live="off">
          <strong>{shortDate(current.date)}</strong>
          <span>Bookings {current.bookings.toLocaleString("en-NG")}</span>
          <span>Orders {current.orders.toLocaleString("en-NG")}</span>
        </output>
      </div>
      {total === 0 && (
        <p className="overview-empty">No new bookings or orders in this period.</p>
      )}
      <div className="overview-chart-controls">
        <label htmlFor={`${id}-day`}>Inspect day</label>
        <input
          id={`${id}-day`}
          type="range"
          min="0"
          max={rows.length - 1}
          value={selected}
          onChange={(event) => setSelected(Number(event.target.value))}
          aria-valuetext={`${current.date}: ${current.bookings} bookings, ${current.orders} orders`}
        />
        <span>{current.date}</span>
      </div>
      <details className="overview-data">
        <summary>View daily data</summary>
        <div
          className="table-region"
          role="region"
          aria-label="Daily activity data"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Date (Lagos)</th>
                <th>Bookings</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <th scope="row">{row.date}</th>
                  <td>{row.bookings}</td>
                  <td>{row.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
