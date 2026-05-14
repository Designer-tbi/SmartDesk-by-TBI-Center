# EXTERNAL_API_KEY for partner-platform provisioning
EXTERNAL_API_KEY=6c9fcb634abe477d1e8643c51517f6e59ac7ebde1d1d05945c57e959c25ac998

# Sample partner request:
#
# curl -X POST https://<smartdesk-host>/api/external/companies \
#   -H "X-API-Key: $EXTERNAL_API_KEY" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "name": "Acme SARL",
#     "adminEmail": "admin@acme.example",
#     "country": "CG",
#     "city": "Brazzaville",
#     "externalRef": "ACME-001",
#     "rccm": "...",
#     "legalForm": "SARL — Société à Responsabilité Limitée",
#     "capital": 1000000,
#     "cnssEmployerRate": 16,
#     "cnssEmployeeRate": 4
#   }'
#
# Returns: { company: {...}, admin: { email, password (16 chars, ONCE) } }
