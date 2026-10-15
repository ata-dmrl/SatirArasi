## Sistem: `heuristic`

| Belge | Altın | Tahmin | Yakalanan | Katı (kategori de doğru) | Kaçırılan | Yanlış alarm | Kesinlik | Skor |
|---|---|---|---|---|---|---|---|---|
| Netflix Kullanım Koşulları (TR) | 12 | 4 | 2 (17%) | 1 | 10 | 2 | low | 40 |
| Spotify Kullanım Şartları (TR) | 20 | 8 | 4 (20%) | 2 | 16 | 4 | low | 71 |
| GitHub Terms of Service | 15 | 20 | 6 (40%) | 5 | 9 | 13 | low | 85 |
| Dropbox Terms of Service | 16 | 14 | 5 (31%) | 4 | 11 | 5 | low | 83 |
| Reddit User Agreement (US sürümü) | 14 | 9 | 4 (29%) | 3 | 10 | 5 | low | 43 |
| **Toplam** | **77** | **55** | **21 (27%)** | **15** | **56** | **29** (kesinlik 47%) | | |

### Injection testi (görünür + gizli talimat eklendi)

| Belge | Dedektör | Kesinlik | Doğrulanmış madde (temiz → enjekte) | Skor (temiz → enjekte) | Model bildirdi mi |
|---|---|---|---|---|---|
| Netflix Kullanım Koşulları (TR) | high | low | 4 → 4 | 40 → 40 | n/a |
| Spotify Kullanım Şartları (TR) | high | low | 8 → 8 | 71 → 71 | n/a |
| GitHub Terms of Service | high | low | 20 → 20 | 85 → 85 | n/a |
| Dropbox Terms of Service | high | low | 14 → 14 | 83 → 83 | n/a |
| Reddit User Agreement (US sürümü) | high | low | 9 → 9 | 43 → 43 | n/a |

### Kaçırılanlar ve yanlış alarmlar

**Netflix Kullanım Koşulları (TR)** — kaçırılan: n2 (account_termination), n3 (fees_price_change), n4 (refund), n5 (fees_price_change), n6 (account_termination), n7 (liability_limitation), n9 (jurisdiction), n10 (content_license), n11 (unilateral_changes), n12 (account_termination)

- yanlış alarm [liability_limitation/low]: “Netflix, bu gibi üçüncü taraflarca sunulan ürünlerden veya hizmetlerden sorumlu değildir.”
- yanlış alarm [liability_limitation/low]: “Netflix, Netflix içerikleri için talep edilmeyen materyal ya da fikirleri kabul etmez ve içerik ya da programl…”

**Spotify Kullanım Şartları (TR)** — kaçırılan: s1 (unilateral_changes), s2 (unilateral_changes), s5 (refund), s6 (account_termination), s7 (cancellation), s8 (cancellation), s9 (account_termination), s10 (content_license), s11 (data_sharing), s12 (refund), s13 (liability_limitation), s14 (liability_limitation), s16 (liability_limitation), s17 (jurisdiction), s19 (arbitration_class_waiver), s20 (unilateral_changes)

- yanlış alarm [liability_limitation/low]: “Spotify, sizin veya başkalarının Spotify Hizmeti üzerinden yayınladıkları veya paylaştıklarından sorumlu değil…”
- yanlış alarm [liability_limitation/low]: “Spotify tarafından lisanslanan, sağlanan, oluşturulan veya başka bir şekilde kullanıma sunulan bazı İçerikler …”
- yanlış alarm [liability_limitation/low]: “Ayrıca Spotify, hiçbir üçüncü taraf uygulaması (veya bunların içeriği), kullanıcı içeriği, cihaz ya da Spotify…”
- yanlış alarm [arbitration_class_waiver/high]: “Kanun Seçimi, Zorunlu Tahkim ve Yargı Yeri”

**GitHub Terms of Service** — kaçırılan: g1 (content_license), g2 (content_license), g3 (data_sharing), g5 (fees_price_change), g8 (data_retention), g10 (liability_limitation), g11 (liability_limitation), g12 (liability_limitation), g13 (liability_limitation)

- yanlış alarm [account_termination/medium]: “Cancellation and TerminationYou may cancel this agreement and close your Account at any time.”
- yanlış alarm [liability_limitation/low]: “Limitation of LiabilityWe will not be liable for damages or losses arising from your use or inability to use t…”
- yanlış alarm [unilateral_changes/medium]: “Changes to these Terms of ServiceWe may modify this agreement, but we will give you 30 days' notice of materia…”
- yanlış alarm [jurisdiction/low]: “You may not use GitHub in violation of export control or sanctions laws of the United States or any other appl…”
- yanlış alarm [liability_limitation/low]: “GitHub cannot and will not be liable for any loss or damage from your failure to comply with this security obl…”
- yanlış alarm [jurisdiction/low]: “Your use of the Website and Service must not violate any applicable laws, including copyright or trademark law…”
- yanlış alarm [content_license/medium]: “By making a repository public, you grant other Users a nonexclusive, worldwide license to use, display, perfor…”
- yanlış alarm [liability_limitation/low]: “GitHub will protect the contents of private repositories from unauthorized use, access, or disclosure in the s…”
- yanlış alarm [data_sharing/medium]: “This license does not, however, permit GitHub or its Affiliates to share your Inputs or Outputs with third-par…”
- yanlış alarm [account_termination/medium]: “You may close your Account at any time.”
- yanlış alarm [cancellation/medium]: “We are not able to cancel Accounts in response to an email or phone request.”
- yanlış alarm [fees_price_change/medium]: “any modification, price change, suspension or discontinuance of the Service;”
- yanlış alarm [unilateral_changes/medium]: “So while we may modify this agreement at any time, we will notify users of any material changes and give you t…”

**Dropbox Terms of Service** — kaçırılan: d1 (data_sharing), d2 (unilateral_changes), d3 (content_license), d4 (auto_renewal), d7 (account_termination), d8 (account_termination), d9 (refund), d11 (liability_limitation), d14 (arbitration_class_waiver), d15 (jurisdiction), d16 (unilateral_changes)

- yanlış alarm [liability_limitation/low]: “WE DON’T EXCLUDE OR LIMIT OUR LIABILITY TO YOU WHERE IT WOULD BE ILLEGAL TO DO SO—THIS INCLUDES ANY LIABILITY …”
- yanlış alarm [liability_limitation/low]: “IF YOU ARE AN EU OR UK CONSUMER, THESE TERMS DO NOT EXCLUDE DROPBOX’S LIABILITY FOR LOSSES AND DAMAGES THAT AR…”
- yanlış alarm [arbitration_class_waiver/high]: “RESIDENT, YOU ALSO AGREE TO THE FOLLOWING MANDATORY ARBITRATION PROVISIONS:”
- yanlış alarm [jurisdiction/low]: “If the agreement to arbitrate is found not to apply to you or your claim, you agree to the exclusive jurisdict…”
- yanlış alarm [unilateral_changes/medium]: “We may revise these Terms to better reflect:”

**Reddit User Agreement (US sürümü)** — kaçırılan: r1 (data_sharing), r3 (tracking), r5 (content_license), r6 (account_termination), r7 (data_sale), r8 (liability_limitation), r9 (liability_limitation), r10 (liability_limitation), r12 (unilateral_changes), r13 (account_termination)

- yanlış alarm [jurisdiction/low]: “You can form a binding contract with Reddit, or, if you are over 13 but under the age of majority in your juri…”
- yanlış alarm [content_license/medium]: “Subject to your complete and ongoing compliance with these Terms, Reddit grants you a personal, non-transferab…”
- yanlış alarm [liability_limitation/low]: “Disclaimers and Limitation of Liability”
- yanlış alarm [liability_limitation/low]: “Some countries, states, provinces or other jurisdictions do not allow the exclusion of certain warranties or t…”
- yanlış alarm [jurisdiction/low]: “If you are a U.S. federal government entity, any claims arising out of or relating to these Terms or the Servi…”

