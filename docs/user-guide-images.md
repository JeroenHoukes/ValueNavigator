# User guide slide images

Static files live in `frontend/public/user-guide/`. They were exported from **User Guide 0.2.pptx** (`ppt/media/*.png` inside the `.pptx` zip).

## Refreshing after a new PowerPoint version

1. Unzip the `.pptx` (it is a zip file), or `unzip -o "User Guide 0.2.pptx" -d /tmp/vn-pptx`.
2. Copy from `ppt/media/` into `frontend/public/user-guide/` using the same filenames as referenced in `frontend/src/content/userGuide.ts` (`/user-guide/…` paths).

Naming map used in the repo:

| Public file | Source (typical) |
|-------------|------------------|
| `welcome.png` | `image4.png` |
| `improvements.png` | `image5.png` |
| `guide-ui-links.png` | `image7.png` |
| `guide-ui-prev-next.png` | `image8.png` |
| `icon-legend-01.png` … `09.png` | `image9.png` … `image17.png` (slide 16 embed order) |
| `lists-deselect.png` | `image18.png` |
| `lists-filter.png` | `image19.png` |
| `login.png` | `image20.png` |
| `navigate-quick-menu.png` | `image21.png` |
| `navigate-inset.png` | `image14.png` |
| `search-field.png` | `image22.png` |
| `search-results.png` | `image23.png` |
| `create-product.png` | `image24.png` |
| `one-off-charges.png` | `image25.png` |

**Note:** Slide 9 in the deck uses `image6.emf` (Excel chart). Browsers cannot display EMF; the **Forecast data** section explains that in the web guide.
