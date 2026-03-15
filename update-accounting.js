import fs from 'fs';

let content = fs.readFileSync('src/modules/Accounting.tsx', 'utf8');

content = content.replace(/€/g, '{currencySymbol}');
content = content.replace(/\${currencySymbol}/g, '${currencySymbol}'); // Fix template literals
content = content.replace(/'Montant \({currencySymbol}\)'/g, "'Montant (' + currencySymbol + ')'");
content = content.replace(/RÉSULTAT NET : \${net\.toLocaleString\(\)} {currencySymbol}/g, 'RÉSULTAT NET : ${net.toLocaleString()} ${currencySymbol}');
content = content.replace(/TVA/g, '{taxLabel}');
// Fix some specific TVA strings
content = content.replace(/'{taxLabel}'/g, 'taxLabel');
content = content.replace(/'Déclaration de {taxLabel}'/g, '`Déclaration de ${taxLabel}`');
content = content.replace(/'{taxLabel} Collectée \(Journal\)'/g, '`${taxLabel} Collectée (Journal)`');
content = content.replace(/'{taxLabel} sur Factures Payées'/g, '`${taxLabel} sur Factures Payées`');
content = content.replace(/'TOTAL {taxLabel} COLLECTÉE'/g, '`TOTAL ${taxLabel} COLLECTÉE`');
content = content.replace(/'{taxLabel} Déductible'/g, '`${taxLabel} Déductible`');
content = content.replace(/'{taxLabel} À PAYER \/ CRÉDIT'/g, '`${taxLabel} À PAYER / CRÉDIT`');
content = content.replace(/DÉCLARATION DE {taxLabel}/g, 'DÉCLARATION DE ${taxLabel.toUpperCase()}');
content = content.replace(/Declaration_{taxLabel}_/g, 'Declaration_${taxLabel}_');

fs.writeFileSync('src/modules/Accounting.tsx', content);
