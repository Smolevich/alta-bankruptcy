Подложка карты отделений (/vyplata/#otdeleniya). Всё отдаётся с нашего домена.

serbia.pmtiles  — в git не лежит (50 МБ): файл в бакете R2 alta-map, сервис отдаёт его на
                  /map/serbia.pmtiles с Range (backend/src/alta_feedback/map_tiles.py).
                  Выжимка Protomaps Basemap, сборка 20261106 (данные © OpenStreetMap, ODbL),
                  zoom 0–13 по Сербии и 14–15 вокруг 13 городов с отделениями Poštanska.
                  Заменить: залить новый файл в бакет под тем же ключом и сбросить кэш Cloudflare.
style-*.json    — слои @protomaps/basemaps 5.7.2 (flavor light, подписи ru / en / sr-Latn),
                  без иконок, спрайтов и щитов дорог.
fonts/          — глифы Noto Sans (SIL OFL 1.1) из protomaps/basemaps-assets, только латиница,
                  кириллица и пунктуация.
Движок — MapLibre GL JS 6.15.0 (BSD-3, LICENSE-maplibre.txt) и pmtiles 4.5.0 (BSD-3) в /vendor/maplibre.
