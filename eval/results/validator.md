## Doğrulayıcı eval'i (deterministik, LLM'siz)

5 gerçek ToS metni, 77 altın madde × 8 varyant.

| Varyant | Beklenen | Doğru karar | Ret nedenleri |
|---|---|---|---|
| verbatim | kabul | 77/77 (100%) | – |
| typography | kabul | 77/77 (100%) | – |
| paraphrase | ret | 77/77 (100%) | quote_not_verbatim: 75, quote_not_found: 2 |
| negation | ret | 77/77 (100%) | quote_not_verbatim: 76, quote_not_found: 1 |
| word_drop | ret | 77/77 (100%) | quote_not_verbatim: 76, quote_not_found: 1 |
| ellipsis | ret | 77/77 (100%) | quote_not_verbatim: 77 |
| fabricated | ret | 77/77 (100%) | quote_not_found: 73, quote_not_verbatim: 4 |
| hidden_only | ret | 77/77 (100%) | quote_from_hidden: 77 |

### Hatalı kararlar (0)

