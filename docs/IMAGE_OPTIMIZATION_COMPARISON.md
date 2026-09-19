# Image optimization comparison

## Summary

| Metric | Before | After | Difference |
|---|---:|---:|---:|
| Raster image assets | 39.11 MB | 28.14 MB | **10.97 MB smaller (28.1%)** |
| Lossless WebP files | 0 | 41 | 41 converted |
| PNG files retained | 43 | 2 | 2 retained because WebP was larger |
| Dimensions changed | — | — | **0** |
| Visible pixels changed | — | — | **0** |

All converted files use lossless WebP. The decoded pixels, alpha channel, and
dimensions were compared against the original Git versions. Existing `.png`
URLs for converted bundled images are rewritten to their `.webp` equivalents,
so previously saved project records continue to work.

## Per-image comparison

| Image | Before | After | Saved |
|---|---:|---:|---:|
| `project-ls-ecommerce-detail-blog.png` → `project-ls-ecommerce-detail-blog.webp` | 2096.1 KB | 1438.8 KB | 31.4% |
| `project-oralguard-lk-detail-clinics.png` → `project-oralguard-lk-detail-clinics.webp` | 2051.9 KB | 1459.9 KB | 28.8% |
| `project-ls-ecommerce-detail-home.png` → `project-ls-ecommerce-detail-home.webp` | 1759.1 KB | 1274.4 KB | 27.6% |
| `project-lms-detail-mobile.png` → `project-lms-detail-mobile.webp` | 1669.0 KB | 1152.0 KB | 31.0% |
| `project-ls-ecommerce-detail-contact.png` → `project-ls-ecommerce-detail-contact.webp` | 1593.7 KB | 1097.4 KB | 31.1% |
| `brand-ls-computer-technology.png` → `brand-ls-computer-technology.webp` | 1528.9 KB | 972.6 KB | 36.4% |
| `project-cafs-detail-login.png` → `project-cafs-detail-login.webp` | 1500.2 KB | 1114.3 KB | 25.7% |
| `project-cafs-detail-dashboard.png` → `project-cafs-detail-dashboard.webp` | 1486.3 KB | 1044.0 KB | 29.8% |
| `project-lms.png` → `project-lms.webp` | 1426.8 KB | 1074.5 KB | 24.7% |
| `project-climedge-home.png` → `project-climedge-home.webp` | 1389.4 KB | 1045.5 KB | 24.7% |
| `project-ls-ecommerce.png` → `project-ls-ecommerce.webp` | 1388.8 KB | 925.5 KB | 33.4% |
| `project-oralguard-lk.png` → `project-oralguard-lk.webp` | 1328.1 KB | 1050.3 KB | 20.9% |
| `project-cafs.png` → `project-cafs.webp` | 1323.8 KB | 982.9 KB | 25.8% |
| `project-cafs-detail-mission.png` → `project-cafs-detail-mission.webp` | 1264.4 KB | 870.4 KB | 31.2% |
| `project-climedge-clean-energy.png` → `project-climedge-clean-energy.webp` | 1237.0 KB | 927.1 KB | 25.1% |
| `project-bambinoo-detail-center.png` → `project-bambinoo-detail-center.webp` | 1218.6 KB | 898.8 KB | 26.2% |
| `project-climedge-plans.png` → `project-climedge-plans.webp` | 1217.9 KB | 902.1 KB | 25.9% |
| `project-oralguard-lk-detail-screening.png` → `project-oralguard-lk-detail-screening.webp` | 1215.7 KB | 913.0 KB | 24.9% |
| `project-lms-detail-registration.png` → `project-lms-detail-registration.webp` | 1212.4 KB | 873.2 KB | 28.0% |
| `project-climedge.png` → `project-climedge.webp` | 1198.8 KB | 896.3 KB | 25.2% |
| `project-bambinoo-detail-left.png` → `project-bambinoo-detail-left.webp` | 1153.9 KB | 839.6 KB | 27.2% |
| `brand-ict-with-ls.png` → `brand-ict-with-ls.webp` | 1148.5 KB | 660.3 KB | 42.5% |
| `project-lms-detail-admin.png` → `project-lms-detail-admin.webp` | 1107.4 KB | 809.6 KB | 26.9% |
| `project-bambinoo-detail-right.png` → `project-bambinoo-detail-right.webp` | 1093.7 KB | 828.5 KB | 24.3% |
| `project-bambinoo.png` → `project-bambinoo.webp` | 1083.7 KB | 809.7 KB | 25.3% |
| `project-oralguard-lk-detail-onboarding.png` → `project-oralguard-lk-detail-onboarding.webp` | 1035.2 KB | 715.3 KB | 30.9% |
| `lakindu.png` → `lakindu.webp` | 598.9 KB | 316.9 KB | 47.1% |
| `process-handoff.png` → `process-handoff.webp` | 332.0 KB | 314.9 KB | 5.2% |
| `process-design.png` → `process-design.webp` | 251.7 KB | 242.8 KB | 3.5% |
| `process-research.png` → `process-research.webp` | 217.7 KB | 187.5 KB | 13.9% |
| `lakindu-signature.png` → `lakindu-signature.webp` | 171.3 KB | 80.3 KB | 53.1% |
| `brand-ls-studio.png` → `brand-ls-studio.png` | 133.9 KB | 133.9 KB | — |
| `get-in-touch-photo.png` → `get-in-touch-photo.png` | 103.9 KB | 103.9 KB | — |
| `svc-circle-purple.png` → `svc-circle-purple.webp` | 92.6 KB | 75.0 KB | 19.0% |
| `star-teal.png` → `star-teal.webp` | 91.9 KB | 76.2 KB | 17.1% |
| `svc-heart-yellow.png` → `svc-heart-yellow.webp` | 82.9 KB | 64.4 KB | 22.3% |
| `sphere-purple.png` → `sphere-purple.webp` | 66.7 KB | 53.3 KB | 20.1% |
| `svc-sphere-orange.png` → `svc-sphere-orange.webp` | 63.9 KB | 51.3 KB | 19.6% |
| `cube-yellow.png` → `cube-yellow.webp` | 63.9 KB | 51.0 KB | 20.1% |
| `cylinder-blue.png` → `cylinder-blue.webp` | 61.7 KB | 48.5 KB | 21.4% |
| `pyramid-orange.png` → `pyramid-orange.webp` | 53.4 KB | 43.3 KB | 19.0% |
| `capsule-lime.png` → `capsule-lime.webp` | 50.2 KB | 37.6 KB | 25.1% |
| `process-develop.png` → `process-develop.webp` | 25.0 KB | 20.9 KB | 16.4% |
