Подложка карты отделений (/vyplata/#otdeleniya). Всё отдаётся с нашего домена.

serbia.pmtiles  — выжимка Protomaps Basemap, сборка 20261106 (данные © OpenStreetMap, ODbL),
                  прямоугольники вокруг городов с отделениями Poštanska, zoom 0–13 (выше — overzoom).
                  go-pmtiles extract https://build.protomaps.com/20261106.pmtiles --region=<города> --maxzoom=13
style-*.json    — слои @protomaps/basemaps 5.7.2 (flavor light, подписи ru / en / sr-Latn),
                  без иконок, спрайтов и щитов дорог.
fonts/          — глифы Noto Sans (SIL OFL 1.1) из protomaps/basemaps-assets, только латиница,
                  кириллица и пунктуация.
Движок — MapLibre GL JS 6.15.0 (BSD-3, LICENSE-maplibre.txt) и pmtiles 4.5.0 (BSD-3) в /vendor/maplibre.
