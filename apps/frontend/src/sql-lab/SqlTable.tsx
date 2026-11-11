import type { SqlResult } from "./exercise";

export function SqlTable({
  result,
  label,
}: {
  result: SqlResult;
  label: string;
}) {
  return (
    <>
      {result.fields.length > 0 && result.rows.length === 0 && (
        <p>Nenhuma linha corresponde à consulta.</p>
      )}
      {result.fields.length > 0 && (
        <div
          className="sql-table-scroll"
          role="region"
          aria-label={label}
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                {result.fields.map((field, index) => (
                  <th key={index} scope="col">
                    {field}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((value, column) => (
                    <td key={column}>
                      {value === null ? (
                        <em>NULL</em>
                      ) : typeof value === "object" ? (
                        JSON.stringify(value)
                      ) : (
                        String(value)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
