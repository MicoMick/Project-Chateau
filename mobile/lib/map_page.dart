import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'app_colors.dart';
import 'app_config.dart';

const double _entranceLat = 14.300935743300982;
const double _entranceLng = 120.89973237974166;
const double _coveredCourtLat = 14.303429068391898;
const double _coveredCourtLng = 120.90027185857198;
const double _hoaOfficeLat = 14.303143171267385;
const double _hoaOfficeLng = 120.89999760269713;
const double _subdivisionLat = 14.3020;
const double _subdivisionLng = 120.8998;

const List<Map<String, dynamic>> _streets = [
  {
    'label': 'HOA Entrance',
    'street': 'Landmark',
    'emoji': '🏰',
    'lat': _entranceLat,
    'lng': _entranceLng,
    'isLandmark': true
  },
  {
    'label': 'Covered Court',
    'street': 'Landmark',
    'emoji': '🏟',
    'lat': _coveredCourtLat,
    'lng': _coveredCourtLng,
    'isLandmark': true
  },
  {
    'label': 'HOA Office',
    'street': 'Landmark',
    'emoji': '🏢',
    'lat': _hoaOfficeLat,
    'lng': _hoaOfficeLng,
    'isLandmark': true
  },
  {
    'label': 'Springfield Blk 52 Lot 1',
    'street': 'Springfield',
    'lat': 14.302656132800594,
    'lng': 120.8985096678014
  },
  {
    'label': 'Springfield Blk 52 Lot 3',
    'street': 'Springfield',
    'lat': 14.302665229552291,
    'lng': 120.89856867640124
  },
  {
    'label': 'Springfield Blk 52 Lot 5',
    'street': 'Springfield',
    'lat': 14.302673676535669,
    'lng': 120.89863439052381
  },
  {
    'label': 'Springfield Blk 52 Lot 7',
    'street': 'Springfield',
    'lat': 14.302712012841857,
    'lng': 120.89870211630058
  },
  {
    'label': 'Springfield Blk 52 Lot 9',
    'street': 'Springfield',
    'lat': 14.302752948211381,
    'lng': 120.89874972551182
  },
  {
    'label': 'Springfield Blk 52 Lot 11',
    'street': 'Springfield',
    'lat': 14.302808178461799,
    'lng': 120.89882415681116
  },
  {
    'label': 'Springfield Blk 52 Lot 13',
    'street': 'Springfield',
    'lat': 14.302839367302115,
    'lng': 120.89886371939515
  },
  {
    'label': 'Springfield Blk 52 Lot 15',
    'street': 'Springfield',
    'lat': 14.302870556138611,
    'lng': 120.89891803412497
  },
  {
    'label': 'Springfield Blk 52 Lot 17',
    'street': 'Springfield',
    'lat': 14.302899145901113,
    'lng': 120.89895558505214
  },
  {
    'label': 'Springfield Blk 52 Lot 19',
    'street': 'Springfield',
    'lat': 14.302936832401675,
    'lng': 120.8990058764709
  },
  {
    'label': 'Springfield Blk 52 Lot 21',
    'street': 'Springfield',
    'lat': 14.302963472854449,
    'lng': 120.8990400746367
  },
  {
    'label': 'Springfield Blk 52 Lot 23',
    'street': 'Springfield',
    'lat': 14.303000509577817,
    'lng': 120.89908433108442
  },
  {
    'label': 'Springfield Blk 52 Lot 25',
    'street': 'Springfield',
    'lat': 14.303033647692121,
    'lng': 120.89913126974339
  },
  {
    'label': 'Springfield Blk 52 Lot 27',
    'street': 'Springfield',
    'lat': 14.303086278806651,
    'lng': 120.89919161944533
  },
  {
    'label': 'Springfield Blk 52 Lot 29',
    'street': 'Springfield',
    'lat': 14.303122015974914,
    'lng': 120.89924660473153
  },
  {
    'label': 'Springfield Blk 52 Lot 31',
    'street': 'Springfield',
    'lat': 14.30315515407132,
    'lng': 120.89929689615187
  },
  {
    'label': 'Springfield Blk 52 Lot 33',
    'street': 'Springfield',
    'lat': 14.30320193726047,
    'lng': 120.89933981149272
  },
  {
    'label': 'Springfield Blk 52 Lot 35',
    'street': 'Springfield',
    'lat': 14.30323312604613,
    'lng': 120.89937803297217
  },
  {
    'label': 'Springfield Blk 52 Lot 37',
    'street': 'Springfield',
    'lat': 14.303272112022126,
    'lng': 120.89941625445161
  },
  {
    'label': 'Springfield Blk 52 Lot 39',
    'street': 'Springfield',
    'lat': 14.303309798461491,
    'lng': 120.89947325139148
  },
  {
    'label': 'Springfield Blk 52 Lot 41',
    'street': 'Springfield',
    'lat': 14.30334098723219,
    'lng': 120.8995074495573
  },
  {
    'label': 'Springfield Blk 52 Lot 43',
    'street': 'Springfield',
    'lat': 14.30337542482814,
    'lng': 120.89954097717087
  },
  {
    'label': 'Springfield Blk 52 Lot 45',
    'street': 'Springfield',
    'lat': 14.303422857736257,
    'lng': 120.89958456306576
  },
  {
    'label': 'Springfield Blk 52 Lot 47',
    'street': 'Springfield',
    'lat': 14.303446249302919,
    'lng': 120.89961004405205
  },
  {
    'label': 'New York Blk 52 Lot 2',
    'street': 'New York',
    'lat': 14.302415194643961,
    'lng': 120.8986108602016
  },
  {
    'label': 'New York Blk 52 Lot 4',
    'street': 'New York',
    'lat': 14.302421042562075,
    'lng': 120.89866852769693
  },
  {
    'label': 'New York Blk 52 Lot 6',
    'street': 'New York',
    'lat': 14.302473024050652,
    'lng': 120.89883348355404
  },
  {
    'label': 'New York Blk 52 Lot 8',
    'street': 'New York',
    'lat': 14.302509411087225,
    'lng': 120.89887505778918
  },
  {
    'label': 'New York Blk 52 Lot 10',
    'street': 'New York',
    'lat': 14.302554245103414,
    'lng': 120.89892199644815
  },
  {
    'label': 'New York Blk 52 Lot 12',
    'street': 'New York',
    'lat': 14.302592581429003,
    'lng': 120.89896290013668
  },
  {
    'label': 'New York Blk 52 Lot 14',
    'street': 'New York',
    'lat': 14.302683548954526,
    'lng': 120.89909298727645
  },
  {
    'label': 'New York Blk 52 Lot 16',
    'street': 'New York',
    'lat': 14.30272513409983,
    'lng': 120.89914193758699
  },
  {
    'label': 'New York Blk 52 Lot 18',
    'street': 'New York',
    'lat': 14.302764769931631,
    'lng': 120.89919759342547
  },
  {
    'label': 'New York Blk 52 Lot 20',
    'street': 'New York',
    'lat': 14.302796608545554,
    'lng': 120.89924319097992
  },
  {
    'label': 'New York Blk 52 Lot 22',
    'street': 'New York',
    'lat': 14.302842742039354,
    'lng': 120.89928409466843
  },
  {
    'label': 'New York Blk 52 Lot 24',
    'street': 'New York',
    'lat': 14.302886926224673,
    'lng': 120.89935114989073
  },
  {
    'label': 'New York Blk 52 Lot 26',
    'street': 'New York',
    'lat': 14.302918115054046,
    'lng': 120.89938467750427
  },
  {
    'label': 'New York Blk 52 Lot 28',
    'street': 'New York',
    'lat': 14.302942156440409,
    'lng': 120.89941887567011
  },
  {
    'label': 'New York Blk 52 Lot 30',
    'street': 'New York',
    'lat': 14.302983741538007,
    'lng': 120.8994778842657
  },
  {
    'label': 'New York Blk 52 Lot 32',
    'street': 'New York',
    'lat': 14.303018828955627,
    'lng': 120.89951945850652
  },
  {
    'label': 'New York Blk 52 Lot 34',
    'street': 'New York',
    'lat': 14.303046768932436,
    'lng': 120.89955902109051
  },
  {
    'label': 'New York Blk 52 Lot 36',
    'street': 'New York',
    'lat': 14.303077957739625,
    'lng': 120.89960663030175
  },
  {
    'label': 'New York Blk 52 Lot 38',
    'street': 'New York',
    'lat': 14.303122791644087,
    'lng': 120.8996455223307
  },
  {
    'label': 'New York Blk 52 Lot 40',
    'street': 'New York',
    'lat': 14.303150731607957,
    'lng': 120.89969581375102
  },
  {
    'label': 'New York Blk 52 Lot 42',
    'street': 'New York',
    'lat': 14.303185169233052,
    'lng': 120.89973738799183
  },
  {
    'label': 'New York Blk 52 Lot 44',
    'street': 'New York',
    'lat': 14.303221556151957,
    'lng': 120.89977896223263
  },
  {
    'label': 'New York Blk 54 Lot 1',
    'street': 'New York',
    'lat': 14.302420329528621,
    'lng': 120.89880864024292
  },
  {
    'label': 'New York Blk 54 Lot 3',
    'street': 'New York',
    'lat': 14.302450868654171,
    'lng': 120.89885289669279
  },
  {
    'label': 'New York Blk 54 Lot 5',
    'street': 'New York',
    'lat': 14.302517794810162,
    'lng': 120.89892866909713
  },
  {
    'label': 'New York Blk 54 Lot 7',
    'street': 'New York',
    'lat': 14.302561979056422,
    'lng': 120.89897493720383
  },
  {
    'label': 'New York Blk 54 Lot 9',
    'street': 'New York',
    'lat': 14.302593817699083,
    'lng': 120.89901315868326
  },
  {
    'label': 'New York Blk 54 Lot 11',
    'street': 'New York',
    'lat': 14.302626306105289,
    'lng': 120.89905339181954
  },
  {
    'label': 'New York Blk 54 Lot 13',
    'street': 'New York',
    'lat': 14.302666591726252,
    'lng': 120.89911709428027
  },
  {
    'label': 'New York Blk 54 Lot 15',
    'street': 'New York',
    'lat': 14.302700379657688,
    'lng': 120.89915397465518
  },
  {
    'label': 'New York Blk 54 Lot 17',
    'street': 'New York',
    'lat': 14.30272637037071,
    'lng': 120.89919890165733
  },
  {
    'label': 'New York Blk 54 Lot 19',
    'street': 'New York',
    'lat': 14.30275625968698,
    'lng': 120.89924852252538
  },
  {
    'label': 'New York Blk 54 Lot 21',
    'street': 'New York',
    'lat': 14.302811489936621,
    'lng': 120.89931893051123
  },
  {
    'label': 'New York Blk 54 Lot 23',
    'street': 'New York',
    'lat': 14.302855674125134,
    'lng': 120.89934910536341
  },
  {
    'label': 'New York Blk 54 Lot 25',
    'street': 'New York',
    'lat': 14.302884263889531,
    'lng': 120.89938799739512
  },
  {
    'label': 'New York Blk 54 Lot 27',
    'street': 'New York',
    'lat': 14.302916102487961,
    'lng': 120.89944767654372
  },
  {
    'label': 'New York Blk 54 Lot 29',
    'street': 'New York',
    'lat': 14.302946641546118,
    'lng': 120.8994899213368
  },
  {
    'label': 'New York Blk 54 Lot 31',
    'street': 'New York',
    'lat': 14.302983678271634,
    'lng': 120.89953753054583
  },
  {
    'label': 'New York Blk 54 Lot 33',
    'street': 'New York',
    'lat': 14.303007719650987,
    'lng': 120.89957843423437
  },
  {
    'label': 'New York Blk 54 Lot 35',
    'street': 'New York',
    'lat': 14.303057101937199,
    'lng': 120.89962202012914
  },
  {
    'label': 'New York Blk 54 Lot 37',
    'street': 'New York',
    'lat': 14.303083092608965,
    'lng': 120.89965219498134
  },
  {
    'label': 'New York Blk 54 Lot 39',
    'street': 'New York',
    'lat': 14.303126626978504,
    'lng': 120.89970583916016
  },
  {
    'label': 'New York Blk 54 Lot 41',
    'street': 'New York',
    'lat': 14.30314806927629,
    'lng': 120.89974271953507
  },
  {
    'label': 'Notre Dame Blk 54 Lot 2',
    'street': 'Notre Dame',
    'lat': 14.302235958847376,
    'lng': 120.8990031987198
  },
  {
    'label': 'Notre Dame Blk 54 Lot 4',
    'street': 'Notre Dame',
    'lat': 14.30226714776709,
    'lng': 120.8990447729606
  },
  {
    'label': 'Notre Dame Blk 54 Lot 6',
    'street': 'Notre Dame',
    'lat': 14.302315880447644,
    'lng': 120.8991031110039
  },
  {
    'label': 'Notre Dame Blk 54 Lot 8',
    'street': 'Notre Dame',
    'lat': 14.302345769818501,
    'lng': 120.89914066193107
  },
  {
    'label': 'Notre Dame Blk 54 Lot 10',
    'street': 'Notre Dame',
    'lat': 14.302384755948422,
    'lng': 120.89918558893324
  },
  {
    'label': 'Notre Dame Blk 54 Lot 12',
    'street': 'Notre Dame',
    'lat': 14.302417244386305,
    'lng': 120.89923051593343
  },
  {
    'label': 'Notre Dame Blk 54 Lot 14',
    'street': 'Notre Dame',
    'lat': 14.302445184437897,
    'lng': 120.89926873741287
  },
  {
    'label': 'Notre Dame Blk 54 Lot 16',
    'street': 'Notre Dame',
    'lat': 14.302485470090032,
    'lng': 120.89932171103814
  },
  {
    'label': 'Notre Dame Blk 54 Lot 18',
    'street': 'Notre Dame',
    'lat': 14.30252445619573,
    'lng': 120.89936261472666
  },
  {
    'label': 'Notre Dame Blk 54 Lot 20',
    'street': 'Notre Dame',
    'lat': 14.30256149298987,
    'lng': 120.89941827056516
  },
  {
    'label': 'Notre Dame Blk 54 Lot 22',
    'street': 'Notre Dame',
    'lat': 14.302604377691255,
    'lng': 120.89947660861272
  },
  {
    'label': 'Notre Dame Blk 54 Lot 24',
    'street': 'Notre Dame',
    'lat': 14.302643363778685,
    'lng': 120.89952287671518
  },
  {
    'label': 'Notre Dame Blk 54 Lot 26',
    'street': 'Notre Dame',
    'lat': 14.302678451249458,
    'lng': 120.8995590865378
  },
  {
    'label': 'Notre Dame Blk 54 Lot 28',
    'street': 'Notre Dame',
    'lat': 14.302711589411267,
    'lng': 120.89960066077857
  },
  {
    'label': 'Notre Dame Blk 54 Lot 30',
    'street': 'Notre Dame',
    'lat': 14.302749925711133,
    'lng': 120.89964692888407
  },
  {
    'label': 'Notre Dame Blk 54 Lot 32',
    'street': 'Notre Dame',
    'lat': 14.302772667580166,
    'lng': 120.8996811270499
  },
  {
    'label': 'Notre Dame Blk 54 Lot 34',
    'street': 'Notre Dame',
    'lat': 14.30281100387166,
    'lng': 120.8997421473018
  },
  {
    'label': 'Notre Dame Blk 54 Lot 36',
    'street': 'Notre Dame',
    'lat': 14.30284349224648,
    'lng': 120.89977969822898
  },
  {
    'label': 'Notre Dame Blk 54 Lot 38',
    'street': 'Notre Dame',
    'lat': 14.302890275497969,
    'lng': 120.89981926081295
  },
  {
    'label': 'Notre Dame Blk 54 Lot 40',
    'street': 'Notre Dame',
    'lat': 14.3029195150252,
    'lng': 120.8998648583674
  },
  {
    'label': 'Notre Dame Blk 54 Lot 42',
    'street': 'Notre Dame',
    'lat': 14.302961749891162,
    'lng': 120.89989570377185
  },
  {
    'label': 'Notre Dame Blk 55 Lot 1',
    'street': 'Notre Dame',
    'lat': 14.30220927693995,
    'lng': 120.89901527936917
  },
  {
    'label': 'Notre Dame Blk 55 Lot 3',
    'street': 'Notre Dame',
    'lat': 14.302258009630895,
    'lng': 120.89905752416222
  },
  {
    'label': 'Notre Dame Blk 55 Lot 5',
    'street': 'Notre Dame',
    'lat': 14.302282051087868,
    'lng': 120.8990863579099
  },
  {
    'label': 'Notre Dame Blk 55 Lot 7',
    'street': 'Notre Dame',
    'lat': 14.302322336769073,
    'lng': 120.8991480487165
  },
  {
    'label': 'Notre Dame Blk 55 Lot 9',
    'street': 'Notre Dame',
    'lat': 14.302349627063583,
    'lng': 120.89918895240504
  },
  {
    'label': 'Notre Dame Blk 55 Lot 11',
    'street': 'Notre Dame',
    'lat': 14.302394461111641,
    'lng': 120.8992311971981
  },
  {
    'label': 'Notre Dame Blk 55 Lot 13',
    'street': 'Notre Dame',
    'lat': 14.302436046309795,
    'lng': 120.89928417082321
  },
  {
    'label': 'Notre Dame Blk 55 Lot 15',
    'street': 'Notre Dame',
    'lat': 14.302468534738823,
    'lng': 120.89931903954131
  },
  {
    'label': 'Notre Dame Blk 55 Lot 17',
    'street': 'Notre Dame',
    'lat': 14.30251076968954,
    'lng': 120.8993907886343
  },
  {
    'label': 'Notre Dame Blk 55 Lot 19',
    'street': 'Notre Dame',
    'lat': 14.302544557647133,
    'lng': 120.8994303512136
  },
  {
    'label': 'Notre Dame Blk 55 Lot 21',
    'street': 'Notre Dame',
    'lat': 14.302582893974376,
    'lng': 120.89948533649982
  },
  {
    'label': 'Notre Dame Blk 55 Lot 23',
    'street': 'Notre Dame',
    'lat': 14.302625541773876,
    'lng': 120.89953666963493
  },
  {
    'label': 'Notre Dame Blk 55 Lot 25',
    'street': 'Notre Dame',
    'lat': 14.302663179226325,
    'lng': 120.89957858681099
  },
  {
    'label': 'Notre Dame Blk 55 Lot 27',
    'street': 'Notre Dame',
    'lat': 14.302686570872059,
    'lng': 120.89961345552908
  },
  {
    'label': 'Notre Dame Blk 55 Lot 29',
    'street': 'Notre Dame',
    'lat': 14.302721008568282,
    'lng': 120.8996543592176
  },
  {
    'label': 'Notre Dame Blk 55 Lot 31',
    'street': 'Notre Dame',
    'lat': 14.30275414672382,
    'lng': 120.89970532119021
  },
  {
    'label': 'Notre Dame Blk 55 Lot 33',
    'street': 'Notre Dame',
    'lat': 14.302771040683599,
    'lng': 120.8997401899083
  },
  {
    'label': 'Notre Dame Blk 55 Lot 35',
    'street': 'Notre Dame',
    'lat': 14.30282757046674,
    'lng': 120.8997958457407
  },
  {
    'label': 'Notre Dame Blk 55 Lot 37',
    'street': 'Notre Dame',
    'lat': 14.30287500348891,
    'lng': 120.89985083102692
  },
  {
    'label': 'Notre Dame Blk 55 Lot 39',
    'street': 'Notre Dame',
    'lat': 14.302905542552681,
    'lng': 120.89989441692454
  },
  {
    'label': 'Notre Dame Blk 55 Lot 41',
    'street': 'Notre Dame',
    'lat': 14.302942579285537,
    'lng': 120.89993666171591
  },
  {
    'label': 'Notre Dame Blk 55 Lot 43',
    'street': 'Notre Dame',
    'lat': 14.302967270436321,
    'lng': 120.89999701142035
  },
  {
    'label': 'Notre Dame Blk 55 Lot 45',
    'street': 'Notre Dame',
    'lat': 14.303000408556136,
    'lng': 120.90004395007803
  },
  {
    'label': 'Notre Dame Blk 55 Lot 47',
    'street': 'Notre Dame',
    'lat': 14.303029648069053,
    'lng': 120.90007814824384
  },
  {
    'label': 'Notre Dame Blk 55 Lot 49',
    'street': 'Notre Dame',
    'lat': 14.303075131750518,
    'lng': 120.90011838137653
  },
  {
    'label': 'Notre Dame Blk 55 Lot 51',
    'street': 'Notre Dame',
    'lat': 14.303108919620517,
    'lng': 120.90016666114005
  },
  {
    'label': 'Notre Dame Blk 55 Lot 53',
    'street': 'Notre Dame',
    'lat': 14.303135148586666,
    'lng': 120.90020657304167
  },
  {
    'label': 'Notre Dame Blk 55 Lot 55',
    'street': 'Notre Dame',
    'lat': 14.303157028736113,
    'lng': 120.90023893782742
  },
  {
    'label': 'Stanford Blk 55 Lot 2',
    'street': 'Stanford',
    'lat': 14.302016667110093,
    'lng': 120.89917530296543
  },
  {
    'label': 'Stanford Blk 55 Lot 4',
    'street': 'Stanford',
    'lat': 14.302045906750998,
    'lng': 120.89922022996554
  },
  {
    'label': 'Stanford Blk 55 Lot 6',
    'street': 'Stanford',
    'lat': 14.302080344545388,
    'lng': 120.89926314530894
  },
  {
    'label': 'Stanford Blk 55 Lot 8',
    'street': 'Stanford',
    'lat': 14.302119980490897,
    'lng': 120.89930807230904
  },
  {
    'label': 'Stanford Blk 55 Lot 10',
    'street': 'Stanford',
    'lat': 14.302145321501582,
    'lng': 120.89935769317484
  },
  {
    'label': 'Stanford Blk 55 Lot 12',
    'street': 'Stanford',
    'lat': 14.302173911356347,
    'lng': 120.89939658520478
  },
  {
    'label': 'Stanford Blk 55 Lot 14',
    'street': 'Stanford',
    'lat': 14.302218745442751,
    'lng': 120.89943145392286
  },
  {
    'label': 'Stanford Blk 55 Lot 16',
    'street': 'Stanford',
    'lat': 14.302320074586833,
    'lng': 120.89956146795076
  },
  {
    'label': 'Stanford Blk 55 Lot 18',
    'street': 'Stanford',
    'lat': 14.302362994174477,
    'lng': 120.8996373134669
  },
  {
    'label': 'Stanford Blk 55 Lot 20',
    'street': 'Stanford',
    'lat': 14.302408477988584,
    'lng': 120.89968894598941
  },
  {
    'label': 'Stanford Blk 55 Lot 22',
    'street': 'Stanford',
    'lat': 14.302418224518975,
    'lng': 120.89970839200438
  },
  {
    'label': 'Stanford Blk 55 Lot 24',
    'street': 'Stanford',
    'lat': 14.302446814339035,
    'lng': 120.89974862513878
  },
  {
    'label': 'Stanford Blk 55 Lot 26',
    'street': 'Stanford',
    'lat': 14.302473454849912,
    'lng': 120.89977477667621
  },
  {
    'label': 'Stanford Blk 55 Lot 28',
    'street': 'Stanford',
    'lat': 14.302516989336482,
    'lng': 120.89982037422853
  },
  {
    'label': 'Stanford Blk 55 Lot 30',
    'street': 'Stanford',
    'lat': 14.30254492937567,
    'lng': 120.89987267730329
  },
  {
    'label': 'Stanford Blk 55 Lot 32',
    'street': 'Stanford',
    'lat': 14.302591062922724,
    'lng': 120.89993168590416
  },
  {
    'label': 'Stanford Blk 55 Lot 34',
    'street': 'Stanford',
    'lat': 14.302617703418552,
    'lng': 120.89996588407021
  },
  {
    'label': 'Stanford Blk 55 Lot 36',
    'street': 'Stanford',
    'lat': 14.30264889228529,
    'lng': 120.9000054466524
  },
  {
    'label': 'Stanford Blk 55 Lot 38',
    'street': 'Stanford',
    'lat': 14.302688528130538,
    'lng': 120.90003964481666
  },
  {
    'label': 'Stanford Blk 55 Lot 40',
    'street': 'Stanford',
    'lat': 14.302704772327726,
    'lng': 120.90007384298126
  },
  {
    'label': 'Stanford Blk 55 Lot 42',
    'street': 'Stanford',
    'lat': 14.302737910487437,
    'lng': 120.90011876998327
  },
  {
    'label': 'Stanford Blk 55 Lot 44',
    'street': 'Stanford',
    'lat': 14.302769749105149,
    'lng': 120.90015900311771
  },
  {
    'label': 'Stanford Blk 55 Lot 46',
    'street': 'Stanford',
    'lat': 14.302810034696625,
    'lng': 120.90019923625213
  },
  {
    'label': 'Stanford Blk 55 Lot 48',
    'street': 'Stanford',
    'lat': 14.30284837098088,
    'lng': 120.90025288043346
  },
  {
    'label': 'Stanford Blk 55 Lot 50',
    'street': 'Stanford',
    'lat': 14.302870463072592,
    'lng': 120.90028774914994
  },
  {
    'label': 'Stanford Blk 55 Lot 52',
    'street': 'Stanford',
    'lat': 14.302900352369676,
    'lng': 120.90031993565749
  },
  {
    'label': 'Stanford Blk 55 Lot 54',
    'street': 'Stanford',
    'lat': 14.302926343059582,
    'lng': 120.90036150989638
  },
  {
    'label': 'Stanford Blk 56 Lot 1',
    'street': 'Stanford',
    'lat': 14.302075412849865,
    'lng': 120.89933220149642
  },
  {
    'label': 'Stanford Blk 56 Lot 3',
    'street': 'Stanford',
    'lat': 14.302127394417457,
    'lng': 120.89939121009358
  },
  {
    'label': 'Stanford Blk 56 Lot 5',
    'street': 'Stanford',
    'lat': 14.30216443127704,
    'lng': 120.89941803218319
  },
  {
    'label': 'Stanford Blk 56 Lot 7',
    'street': 'Stanford',
    'lat': 14.302191071824215,
    'lng': 120.89947569967941
  },
  {
    'label': 'Stanford Blk 56 Lot 9',
    'street': 'Stanford',
    'lat': 14.302289186972489,
    'lng': 120.89960645736629
  },
  {
    'label': 'Stanford Blk 56 Lot 11',
    'street': 'Stanford',
    'lat': 14.302328173113922,
    'lng': 120.89965406657889
  },
  {
    'label': 'Stanford Blk 56 Lot 13',
    'street': 'Stanford',
    'lat': 14.302365209940413,
    'lng': 120.89970167578798
  },
  {
    'label': 'Stanford Blk 56 Lot 15',
    'street': 'Stanford',
    'lat': 14.302407444910544,
    'lng': 120.8997553199672
  },
  {
    'label': 'Stanford Blk 56 Lot 17',
    'street': 'Stanford',
    'lat': 14.302439283578588,
    'lng': 120.89982036354034
  },
  {
    'label': 'Stanford Blk 56 Lot 19',
    'street': 'Stanford',
    'lat': 14.302481518534801,
    'lng': 120.89985992612252
  },
  {
    'label': 'Stanford Blk 56 Lot 21',
    'street': 'Stanford',
    'lat': 14.302510758115224,
    'lng': 120.89990686477935
  },
  {
    'label': 'Stanford Blk 56 Lot 23',
    'street': 'Stanford',
    'lat': 14.30254909444823,
    'lng': 120.8999491095705
  },
  {
    'label': 'Stanford Blk 56 Lot 25',
    'street': 'Stanford',
    'lat': 14.302571186569356,
    'lng': 120.89997995497356
  },
  {
    'label': 'Stanford Blk 56 Lot 27',
    'street': 'Stanford',
    'lat': 14.30262121871949,
    'lng': 120.90003896357278
  },
  {
    'label': 'Stanford Blk 56 Lot 29',
    'street': 'Stanford',
    'lat': 14.302667352249292,
    'lng': 120.90007651449824
  },
  {
    'label': 'Stanford Blk 56 Lot 31',
    'street': 'Stanford',
    'lat': 14.302697241573412,
    'lng': 120.90011875928938
  },
  {
    'label': 'Stanford Blk 56 Lot 33',
    'street': 'Stanford',
    'lat': 14.302725831357975,
    'lng': 120.90015631021485
  },
  {
    'label': 'Stanford Blk 56 Lot 35',
    'street': 'Stanford',
    'lat': 14.302760918819423,
    'lng': 120.90019922556095
  },
  {
    'label': 'Stanford Blk 56 Lot 37',
    'street': 'Stanford',
    'lat': 14.30279925510976,
    'lng': 120.90025823415812
  },
  {
    'label': 'Harvard Blk 56 Lot 2',
    'street': 'Harvard',
    'lat': 14.301892843324953,
    'lng': 120.89948980653116
  },
  {
    'label': 'Harvard Blk 56 Lot 4',
    'street': 'Harvard',
    'lat': 14.301935728153918,
    'lng': 120.89954948568057
  },
  {
    'label': 'Harvard Blk 56 Lot 6',
    'street': 'Harvard',
    'lat': 14.301968866425254,
    'lng': 120.89960044765084
  },
  {
    'label': 'Harvard Blk 56 Lot 8',
    'street': 'Harvard',
    'lat': 14.301996806532568,
    'lng': 120.89963665747182
  },
  {
    'label': 'Harvard Blk 56 Lot 10',
    'street': 'Harvard',
    'lat': 14.302033843413675,
    'lng': 120.89968828999436
  },
  {
    'label': 'Harvard Blk 56 Lot 12',
    'street': 'Harvard',
    'lat': 14.302068281209923,
    'lng': 120.89972852312876
  },
  {
    'label': 'Harvard Blk 56 Lot 14',
    'street': 'Harvard',
    'lat': 14.302100119922507,
    'lng': 120.89977747344233
  },
  {
    'label': 'Harvard Blk 56 Lot 16',
    'street': 'Harvard',
    'lat': 14.302126760474478,
    'lng': 120.8998002722185
  },
  {
    'label': 'Harvard Blk 56 Lot 18',
    'street': 'Harvard',
    'lat': 14.30217159457018,
    'lng': 120.89986397468601
  },
  {
    'label': 'Harvard Blk 56 Lot 20',
    'street': 'Harvard',
    'lat': 14.30220278349884,
    'lng': 120.8999182894175
  },
  {
    'label': 'Harvard Blk 56 Lot 22',
    'street': 'Harvard',
    'lat': 14.302258663651855,
    'lng': 120.89997528635793
  },
  {
    'label': 'Harvard Blk 56 Lot 24',
    'street': 'Harvard',
    'lat': 14.302292451644611,
    'lng': 120.90002423667148
  },
  {
    'label': 'Harvard Blk 56 Lot 26',
    'street': 'Harvard',
    'lat': 14.302323640559706,
    'lng': 120.90006245815428
  },
  {
    'label': 'Harvard Blk 56 Lot 28',
    'street': 'Harvard',
    'lat': 14.302356129004993,
    'lng': 120.90010805570662
  },
  {
    'label': 'Harvard Blk 56 Lot 30',
    'street': 'Harvard',
    'lat': 14.302389267214323,
    'lng': 120.90015499436346
  },
  {
    'label': 'Harvard Blk 56 Lot 32',
    'street': 'Harvard',
    'lat': 14.302417207272326,
    'lng': 120.9001891925291
  },
  {
    'label': 'Harvard Blk 56 Lot 34',
    'street': 'Harvard',
    'lat': 14.302456193389867,
    'lng': 120.90023881339488
  },
  {
    'label': 'Harvard Blk 56 Lot 36',
    'street': 'Harvard',
    'lat': 14.302491280889877,
    'lng': 120.90028977536517
  },
  {
    'label': 'Harvard Blk 56 Lot 38',
    'street': 'Harvard',
    'lat': 14.302532866067953,
    'lng': 120.90033403181303
  },
  {
    'label': 'Harvard Blk 56 Lot 40',
    'street': 'Harvard',
    'lat': 14.30256080610517,
    'lng': 120.90036890052954
  },
  {
    'label': 'Harvard Blk 57 Lot 1',
    'street': 'Harvard',
    'lat': 14.30183536808953,
    'lng': 120.89947514913908
  },
  {
    'label': 'Harvard Blk 57 Lot 3',
    'street': 'Harvard',
    'lat': 14.301873704537748,
    'lng': 120.89953080497504
  },
  {
    'label': 'Harvard Blk 57 Lot 5',
    'street': 'Harvard',
    'lat': 14.301893197644509,
    'lng': 120.89956366203482
  },
  {
    'label': 'Harvard Blk 57 Lot 7',
    'street': 'Harvard',
    'lat': 14.30193283362302,
    'lng': 120.89960322461701
  },
  {
    'label': 'Harvard Blk 57 Lot 9',
    'street': 'Harvard',
    'lat': 14.301967921204719,
    'lng': 120.89965083382607
  },
  {
    'label': 'Harvard Blk 57 Lot 11',
    'street': 'Harvard',
    'lat': 14.30199846039174,
    'lng': 120.89969307861722
  },
  {
    'label': 'Harvard Blk 57 Lot 13',
    'street': 'Harvard',
    'lat': 14.30203744658563,
    'lng': 120.89973599396396
  },
  {
    'label': 'Harvard Blk 57 Lot 15',
    'street': 'Harvard',
    'lat': 14.302071234611654,
    'lng': 120.89978360317302
  },
  {
    'label': 'Harvard Blk 57 Lot 17',
    'street': 'Harvard',
    'lat': 14.302105022632578,
    'lng': 120.89982249520297
  },
  {
    'label': 'Harvard Blk 57 Lot 19',
    'street': 'Harvard',
    'lat': 14.30214660788214,
    'lng': 120.8998741277255
  },
  {
    'label': 'Harvard Blk 57 Lot 21',
    'street': 'Harvard',
    'lat': 14.302205736899882,
    'lng': 120.89996599338765
  },
  {
    'label': 'Harvard Blk 57 Lot 23',
    'street': 'Harvard',
    'lat': 14.302232377439323,
    'lng': 120.89999147437278
  },
  {
    'label': 'Harvard Blk 57 Lot 25',
    'street': 'Harvard',
    'lat': 14.302266165436022,
    'lng': 120.9000330486117
  },
  {
    'label': 'Harvard Blk 57 Lot 27',
    'street': 'Harvard',
    'lat': 14.302299953427658,
    'lng': 120.90007059953717
  },
  {
    'label': 'Harvard Blk 57 Lot 29',
    'street': 'Harvard',
    'lat': 14.302329193034492,
    'lng': 120.90011485598785
  },
  {
    'label': 'Harvard Blk 57 Lot 31',
    'street': 'Harvard',
    'lat': 14.30236687962964,
    'lng': 120.90017386458503
  },
  {
    'label': 'Harvard Blk 57 Lot 33',
    'street': 'Harvard',
    'lat': 14.302400667606125,
    'lng': 120.9002114155105
  },
  {
    'label': 'Harvard Blk 57 Lot 35',
    'street': 'Harvard',
    'lat': 14.302431856503002,
    'lng': 120.90025768361507
  },
  {
    'label': 'Harvard Blk 57 Lot 37',
    'street': 'Harvard',
    'lat': 14.30245264909975,
    'lng': 120.9002979167506
  },
  {
    'label': 'Harvard Blk 57 Lot 38',
    'street': 'Harvard',
    'lat': 14.302505280348527,
    'lng': 120.90034485540747
  },
  {
    'label': 'West Point Blk 57 Lot 2',
    'street': 'West Point',
    'lat': 14.30156942702623,
    'lng': 120.89956595201294
  },
  {
    'label': 'West Point Blk 57 Lot 4',
    'street': 'West Point',
    'lat': 14.301598666725923,
    'lng': 120.89959679741662
  },
  {
    'label': 'West Point Blk 57 Lot 6',
    'street': 'West Point',
    'lat': 14.30162465756688,
    'lng': 120.89963971276092
  },
  {
    'label': 'West Point Blk 57 Lot 8',
    'street': 'West Point',
    'lat': 14.301688335119524,
    'lng': 120.89971414406749
  },
  {
    'label': 'West Point Blk 57 Lot 10',
    'street': 'West Point',
    'lat': 14.301718224574449,
    'lng': 120.8997610827253
  },
  {
    'label': 'West Point Blk 57 Lot 12',
    'street': 'West Point',
    'lat': 14.301753312190385,
    'lng': 120.89981137414436
  },
  {
    'label': 'West Point Blk 57 Lot 14',
    'street': 'West Point',
    'lat': 14.3017916486534,
    'lng': 120.89985428948866
  },
  {
    'label': 'West Point Blk 57 Lot 16',
    'street': 'West Point',
    'lat': 14.301830634880238,
    'lng': 120.8999018986987
  },
  {
    'label': 'West Point Blk 57 Lot 18',
    'street': 'West Point',
    'lat': 14.301859874545949,
    'lng': 120.89994280238624
  },
  {
    'label': 'West Point Blk 57 Lot 20',
    'street': 'West Point',
    'lat': 14.301896911452921,
    'lng': 120.89998102386832
  },
  {
    'label': 'West Point Blk 57 Lot 22',
    'street': 'West Point',
    'lat': 14.301944994442549,
    'lng': 120.9000534435118
  },
  {
    'label': 'West Point Blk 57 Lot 24',
    'street': 'West Point',
    'lat': 14.301986579721053,
    'lng': 120.90011379321255
  },
  {
    'label': 'West Point Blk 57 Lot 26',
    'street': 'West Point',
    'lat': 14.302033363154003,
    'lng': 120.9001573791118
  },
  {
    'label': 'West Point Blk 57 Lot 28',
    'street': 'West Point',
    'lat': 14.30206260279273,
    'lng': 120.90018889506712
  },
  {
    'label': 'West Point Blk 57 Lot 30',
    'street': 'West Point',
    'lat': 14.302093141967958,
    'lng': 120.90023717482984
  },
  {
    'label': 'West Point Blk 57 Lot 32',
    'street': 'West Point',
    'lat': 14.302127579755123,
    'lng': 120.90028076072548
  },
  {
    'label': 'West Point Blk 57 Lot 34',
    'street': 'West Point',
    'lat': 14.302166565922903,
    'lng': 120.90033172269577
  },
  {
    'label': 'West Point Blk 57 Lot 36',
    'street': 'West Point',
    'lat': 14.302189307853222,
    'lng': 120.90036659141454
  },
  {
    'label': 'West Point Blk 58 Lot 1',
    'street': 'West Point',
    'lat': 14.301485598973592,
    'lng': 120.89950077558909
  },
  {
    'label': 'West Point Blk 58 Lot 3',
    'street': 'West Point',
    'lat': 14.301527184338623,
    'lng': 120.89956850136677
  },
  {
    'label': 'West Point Blk 58 Lot 5',
    'street': 'West Point',
    'lat': 14.301552525416659,
    'lng': 120.89960001732273
  },
  {
    'label': 'West Point Blk 58 Lot 7',
    'street': 'West Point',
    'lat': 14.301587613058471,
    'lng': 120.89965030874181
  },
  {
    'label': 'West Point Blk 58 Lot 9',
    'street': 'West Point',
    'lat': 14.301623350465784,
    'lng': 120.89968785966805
  },
  {
    'label': 'West Point Blk 58 Lot 11',
    'street': 'West Point',
    'lat': 14.301650640845725,
    'lng': 120.89972205783302
  },
  {
    'label': 'West Point Blk 58 Lot 13',
    'street': 'West Point',
    'lat': 14.301681829850144,
    'lng': 120.89978576029891
  },
  {
    'label': 'West Point Blk 58 Lot 15',
    'street': 'West Point',
    'lat': 14.301720816096054,
    'lng': 120.8998353811657
  },
  {
    'label': 'West Point Blk 58 Lot 17',
    'street': 'West Point',
    'lat': 14.301763700959901,
    'lng': 120.89988366092952
  },
  {
    'label': 'West Point Blk 58 Lot 19',
    'street': 'West Point',
    'lat': 14.301798788568737,
    'lng': 120.89992992903507
  },
  {
    'label': 'West Point Blk 58 Lot 21',
    'street': 'West Point',
    'lat': 14.301841023646181,
    'lng': 120.89997619714063
  },
  {
    'label': 'West Point Blk 58 Lot 23',
    'street': 'West Point',
    'lat': 14.301879360096626,
    'lng': 120.90002179469687
  },
  {
    'label': 'West Point Blk 58 Lot 25',
    'street': 'West Point',
    'lat': 14.301918996078422,
    'lng': 120.90007208611631
  },
  {
    'label': 'West Point Blk 58 Lot 27',
    'street': 'West Point',
    'lat': 14.30193848918387,
    'lng': 120.90010024931276
  },
  {
    'label': 'West Point Blk 58 Lot 29',
    'street': 'West Point',
    'lat': 14.301967728835534,
    'lng': 120.9001337769255
  },
  {
    'label': 'West Point Blk 58 Lot 31',
    'street': 'West Point',
    'lat': 14.301999567563028,
    'lng': 120.9001673045382
  },
  {
    'label': 'West Point Blk 58 Lot 33',
    'street': 'West Point',
    'lat': 14.302026208127455,
    'lng': 120.90019613828512
  },
  {
    'label': 'West Point Blk 58 Lot 35',
    'street': 'West Point',
    'lat': 14.302069964793722,
    'lng': 120.90026748564274
  },
  {
    'label': 'West Point Blk 58 Lot 37',
    'street': 'West Point',
    'lat': 14.302101153736881,
    'lng': 120.90031911816628
  },
  {
    'label': 'West Point Blk 58 Lot 39',
    'street': 'West Point',
    'lat': 14.302169379538544,
    'lng': 120.9004036077549
  },
  {
    'label': 'West Point Blk 58 Lot 41',
    'street': 'West Point',
    'lat': 14.302207066161277,
    'lng': 120.90044249978563
  },
  {
    'label': 'West Point Blk 58 Lot 43',
    'street': 'West Point',
    'lat': 14.302241503931697,
    'lng': 120.90048474457765
  },
  {
    'label': 'West Point Blk 58 Lot 45',
    'street': 'West Point',
    'lat': 14.302279840311432,
    'lng': 120.90053168323547
  },
  {
    'label': 'West Point Blk 58 Lot 47',
    'street': 'West Point',
    'lat': 14.302309729687686,
    'lng': 120.90057325747523
  },
  {
    'label': 'Anapolis Blk 58 Lot 2',
    'street': 'Anapolis',
    'lat': 14.301272026009524,
    'lng': 120.89965197582053
  },
  {
    'label': 'Anapolis Blk 58 Lot 4',
    'street': 'Anapolis',
    'lat': 14.3013004704398,
    'lng': 120.89970616802107
  },
  {
    'label': 'Anapolis Blk 58 Lot 6',
    'street': 'Anapolis',
    'lat': 14.301342772406358,
    'lng': 120.899746059502
  },
  {
    'label': 'Anapolis Blk 58 Lot 8',
    'street': 'Anapolis',
    'lat': 14.301372675515854,
    'lng': 120.89978896166075
  },
  {
    'label': 'Anapolis Blk 58 Lot 10',
    'street': 'Anapolis',
    'lat': 14.301409872061136,
    'lng': 120.89984465920017
  },
  {
    'label': 'Anapolis Blk 58 Lot 12',
    'street': 'Anapolis',
    'lat': 14.301445609912545,
    'lng': 120.89988078733384
  },
  {
    'label': 'Anapolis Blk 58 Lot 14',
    'street': 'Anapolis',
    'lat': 14.30143102303803,
    'lng': 120.89986874463003
  },
  {
    'label': 'Anapolis Blk 58 Lot 16',
    'street': 'Anapolis',
    'lat': 14.301475513011288,
    'lng': 120.8999282055167
  },
  {
    'label': 'Anapolis Blk 58 Lot 18',
    'street': 'Anapolis',
    'lat': 14.301525837724505,
    'lng': 120.8999801397089
  },
  {
    'label': 'Anapolis Blk 58 Lot 20',
    'street': 'Anapolis',
    'lat': 14.301566680961741,
    'lng': 120.90003433190942
  },
  {
    'label': 'Anapolis Blk 58 Lot 22',
    'street': 'Anapolis',
    'lat': 14.301617734997851,
    'lng': 120.90010508283787
  },
  {
    'label': 'Anapolis Blk 58 Lot 24',
    'street': 'Anapolis',
    'lat': 14.301670977057265,
    'lng': 120.90018185512825
  },
  {
    'label': 'Anapolis Blk 58 Lot 26',
    'street': 'Anapolis',
    'lat': 14.301710361582142,
    'lng': 120.90023002597316
  },
  {
    'label': 'Anapolis Blk 58 Lot 28',
    'street': 'Anapolis',
    'lat': 14.301735159242414,
    'lng': 120.900271422793
  },
  {
    'label': 'Anapolis Blk 58 Lot 30',
    'street': 'Anapolis',
    'lat': 14.301773085070488,
    'lng': 120.90030830359615
  },
  {
    'label': 'Anapolis Blk 58 Lot 32',
    'street': 'Anapolis',
    'lat': 14.301811740234815,
    'lng': 120.90035722711052
  },
  {
    'label': 'Anapolis Blk 58 Lot 34',
    'street': 'Anapolis',
    'lat': 14.301856959475218,
    'lng': 120.90041066664156
  },
  {
    'label': 'Anapolis Blk 58 Lot 36',
    'street': 'Anapolis',
    'lat': 14.301900720024218,
    'lng': 120.90047012752973
  },
  {
    'label': 'Anapolis Blk 58 Lot 38',
    'street': 'Anapolis',
    'lat': 14.301934999113076,
    'lng': 120.90051829837464
  },
  {
    'label': 'Anapolis Blk 58 Lot 40',
    'street': 'Anapolis',
    'lat': 14.301957608722015,
    'lng': 120.90055442650831
  },
  {
    'label': 'Anapolis Blk 58 Lot 42',
    'street': 'Anapolis',
    'lat': 14.302002827933068,
    'lng': 120.90060636070046
  },
  {
    'label': 'Anapolis Blk 58 Lot 44',
    'street': 'Anapolis',
    'lat': 14.30202696991213,
    'lng': 120.9006385656863
  },
  {
    'label': 'Anapolis Blk 58 Lot 46',
    'street': 'Anapolis',
    'lat': 14.302060108170007,
    'lng': 120.9006868454476
  },
  {
    'label': 'Anapolis Blk 58 Lot 48',
    'street': 'Anapolis',
    'lat': 14.302110790202002,
    'lng': 120.90073244299995
  },
  {
    'label': 'Anapolis Blk 58 Lot 50',
    'street': 'Anapolis',
    'lat': 14.302144578216998,
    'lng': 120.90078876938816
  },
];

// ── MapPage ───────────────────────────────────────────────────────────────────

class MapPage extends StatefulWidget {
  const MapPage({super.key});

  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> {
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _showSearch = false;
  Map<String, dynamic>? _selectedStreet;
  Position? _userPosition;
  List<LatLng> _routePoints = [];
  bool _loadingRoute = false;
  String? _routeDistance;
  String? _routeDuration;
  String? _activeStreetFilter;

  // Callbacks registered by the child map widget so FABs can drive it
  VoidCallback? _onCenterSubdivision;
  VoidCallback? _onCenterUser;

  static const _streetNames = [
    'All',
    'Springfield',
    'New York',
    'Notre Dame',
    'Stanford',
    'Harvard',
    'West Point',
    'Anapolis',
  ];

  @override
  void initState() {
    super.initState();
    _requestLocation();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _requestLocation() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.whileInUse ||
        perm == LocationPermission.always) {
      try {
        final pos = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.high);
        if (mounted) {
          setState(() => _userPosition = pos);
          // Pan map to the newly acquired user location
          _onCenterUser?.call();
        }
      } catch (_) {}
    }
  }

  void _centerOnSubdivision() {
    _onCenterSubdivision?.call();
  }

  Future<void> _loadRoute(Map<String, dynamic> street) async {
    setState(() {
      _loadingRoute = true;
      _routePoints = [];
      _routeDistance = null;
      _routeDuration = null;
    });

    final fromLat = _userPosition?.latitude ?? _entranceLat;
    final fromLng = _userPosition?.longitude ?? _entranceLng;
    final toLat = street['lat'] as double;
    final toLng = street['lng'] as double;

    try {
      final url = Uri.parse(
        'https://api.mapbox.com/directions/v5/mapbox/driving'
        '/$fromLng,$fromLat;$toLng,$toLat'
        '?geometries=geojson&overview=full&access_token=${AppConfig.mapboxToken}',
      );
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final routes = data['routes'] as List<dynamic>?;
        if (routes != null && routes.isNotEmpty) {
          final route = routes[0] as Map<String, dynamic>;
          final coords = route['geometry']['coordinates'] as List<dynamic>;
          final points = coords
              .map((c) =>
                  LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()))
              .toList();
          final distanceM = (route['distance'] as num).toDouble();
          final durationS = (route['duration'] as num).toDouble();
          final distStr = distanceM >= 1000
              ? '${(distanceM / 1000).toStringAsFixed(1)} km'
              : '${distanceM.round()} m';
          final durStr = durationS >= 3600
              ? '${(durationS / 3600).floor()}h ${((durationS % 3600) / 60).round()}min'
              : '${(durationS / 60).round()} min';
          if (mounted) {
            setState(() {
              _routePoints = points;
              _routeDistance = distStr;
              _routeDuration = durStr;
            });
          }
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _routePoints = [LatLng(fromLat, fromLng), LatLng(toLat, toLng)];
        });
      }
    }

    if (mounted) setState(() => _loadingRoute = false);
  }

  void _onSearchChanged(String q) {
    final t = q.trim().toLowerCase();
    setState(() {
      _results = t.isEmpty
          ? []
          : _streets
              .where((s) => (s['label'] as String).toLowerCase().contains(t))
              .toList();
    });
  }

  void _selectStreet(Map<String, dynamic> street) {
    _searchCtrl.text = street['label'] as String;
    setState(() {
      _results = [];
      _showSearch = false;
      _selectedStreet = street;
    });
    _loadRoute(street);
  }

  void _clearRoute() {
    setState(() {
      _selectedStreet = null;
      _routePoints = [];
      _routeDistance = null;
      _routeDuration = null;
    });
    _searchCtrl.clear();
  }

  List<Map<String, dynamic>> get _filteredStreets {
    if (_activeStreetFilter == null || _activeStreetFilter == 'All') {
      return _streets.where((s) => s['isLandmark'] != true).toList();
    }
    return _streets
        .where((s) =>
            s['isLandmark'] != true && s['street'] == _activeStreetFilter)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final hasRoute = _selectedStreet != null;

    return Scaffold(
      backgroundColor: const Color(0xFF1A1D2E),
      appBar: AppBar(
        backgroundColor: chateuBackground,
        elevation: 0,
        automaticallyImplyLeading: false,
        title: const Text(
          'HOA Chateau Map',
          style: TextStyle(
              color: Color(0xFF1A1D2E),
              fontWeight: FontWeight.w700,
              fontSize: 18),
        ),
        centerTitle: true,
        actions: [
          if (hasRoute)
            IconButton(
              icon: const Icon(Icons.close_rounded, color: chateuPrimary),
              onPressed: _clearRoute,
            ),
          IconButton(
            icon: Icon(_showSearch ? Icons.close_rounded : Icons.search_rounded,
                color: chateuPrimary),
            onPressed: () => setState(() {
              _showSearch = !_showSearch;
              if (!_showSearch) {
                _searchCtrl.clear();
                _results = [];
              }
            }),
          ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: kIsWeb
                ? _WebMap(
                    selectedStreet: _selectedStreet,
                    userPosition: _userPosition,
                    routePoints: _routePoints,
                    filteredStreets: _filteredStreets,
                    onStreetSelected: _selectStreet,
                    onRegisterCenterSubdivision: (cb) =>
                        _onCenterSubdivision = cb,
                    onRegisterCenterUser: (cb) => _onCenterUser = cb,
                  )
                : _MobileMap(
                    selectedStreet: _selectedStreet,
                    userPosition: _userPosition,
                    routePoints: _routePoints,
                    filteredStreets: _filteredStreets,
                    onLocationReady: (pos) =>
                        setState(() => _userPosition = pos),
                    onStreetSelected: _selectStreet,
                    onRegisterCenterSubdivision: (cb) =>
                        _onCenterSubdivision = cb,
                    onRegisterCenterUser: (cb) => _onCenterUser = cb,
                  ),
          ),

          // Street filter chips
          if (!_showSearch && !hasRoute)
            Positioned(
              top: 10,
              left: 0,
              right: 0,
              child: SizedBox(
                height: 36,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: _streetNames.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 6),
                  itemBuilder: (context, i) {
                    final name = _streetNames[i];
                    final active = (_activeStreetFilter ?? 'All') == name;
                    return GestureDetector(
                      onTap: () => setState(() =>
                          _activeStreetFilter = name == 'All' ? null : name),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: active ? chateuPrimary : Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                                color: Colors.black.withAlpha(30),
                                blurRadius: 6,
                                offset: const Offset(0, 2))
                          ],
                        ),
                        child: Text(
                          name,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color:
                                active ? Colors.white : const Color(0xFF1A1D2E),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),

          // Search overlay
          if (_showSearch)
            Positioned(
              top: 12,
              left: 16,
              right: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _SearchBar(
                      controller: _searchCtrl, onChanged: _onSearchChanged),
                  if (_results.isNotEmpty)
                    _ResultsList(results: _results, onTap: _selectStreet),
                ],
              ),
            ),

          // Route banner
          if (hasRoute && !_showSearch)
            Positioned(
              top: 12,
              left: 16,
              right: 68,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withAlpha(30),
                        blurRadius: 10,
                        offset: const Offset(0, 3))
                  ],
                ),
                child: Row(
                  children: [
                    _loadingRoute
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: chateuPrimary))
                        : const Icon(Icons.route_rounded,
                            color: chateuPrimary, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _selectedStreet!['label'] as String,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF1A1D2E)),
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (_routeDistance != null && _routeDuration != null)
                            Text('$_routeDuration · $_routeDistance',
                                style: const TextStyle(
                                    fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // FABs — offset raised to sit above the taller bottom bar
          Positioned(
            right: 16,
            bottom: mq.padding.bottom + 204,
            child: GestureDetector(
              onTap: _requestLocation,
              child: _Fab(
                  icon: _userPosition != null
                      ? Icons.my_location_rounded
                      : Icons.location_searching_rounded),
            ),
          ),
          Positioned(
            right: 16,
            bottom: mq.padding.bottom + 150,
            child: GestureDetector(
              onTap: _centerOnSubdivision,
              child: const _Fab(icon: Icons.center_focus_strong_rounded),
            ),
          ),

          // Bottom info + nav bar
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.only(
                  left: 16, right: 16, top: 14, bottom: mq.padding.bottom + 14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(20)),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withAlpha(25),
                      blurRadius: 16,
                      offset: const Offset(0, -4))
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Address card — shown when a pin is selected
                  if (hasRoute) ...[
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: chateuPrimary.withAlpha(20),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.location_on_rounded,
                              color: chateuPrimary, size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _selectedStreet!['label'] as String,
                                style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF1A1D2E)),
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                _selectedStreet!['street'] as String? ?? '',
                                style: const TextStyle(
                                    fontSize: 12, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                        if (_routeDistance != null && _routeDuration != null)
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                _routeDuration!,
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF1A1D2E)),
                              ),
                              Text(
                                _routeDistance!,
                                style: const TextStyle(
                                    fontSize: 11, color: Colors.grey),
                              ),
                            ],
                          ),
                        if (_loadingRoute)
                          const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: chateuPrimary)),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ] else ...[
                    // Idle state hint
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: Colors.grey.withAlpha(30),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.touch_app_rounded,
                              color: Colors.grey, size: 22),
                        ),
                        const SizedBox(width: 12),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Tap a pin on the map',
                                style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF1A1D2E))),
                            Text('Select a lot or landmark to navigate',
                                style: TextStyle(
                                    fontSize: 12, color: Colors.grey)),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  // Navigate button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed:
                          hasRoute && !_loadingRoute ? _startNavigation : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: chateuPrimary,
                        disabledBackgroundColor: chateuPrimary.withAlpha(80),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.navigation_rounded,
                              color: Colors.white, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            hasRoute
                                ? 'Start Navigation'
                                : 'Select a destination',
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 15),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _startNavigation() {
    if (_selectedStreet == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _NavigationPage(
          street: _selectedStreet!,
          routePoints: _routePoints,
          userPosition: _userPosition,
          routeDistance: _routeDistance,
          routeDuration: _routeDuration,
        ),
      ),
    );
  }
}

// ── Navigation Page ───────────────────────────────────────────────────────────

class _NavigationPage extends StatefulWidget {
  final Map<String, dynamic> street;
  final List<LatLng> routePoints;
  final Position? userPosition;
  final String? routeDistance;
  final String? routeDuration;

  const _NavigationPage({
    required this.street,
    required this.routePoints,
    this.userPosition,
    this.routeDistance,
    this.routeDuration,
  });

  @override
  State<_NavigationPage> createState() => _NavigationPageState();
}

class _NavigationPageState extends State<_NavigationPage> {
  final MapController _mapController = MapController();
  Position? _currentPos;
  List<LatLng> _remainingRoute = [];
  bool _arrived = false;

  @override
  void initState() {
    super.initState();
    _currentPos = widget.userPosition;
    _remainingRoute = List.from(widget.routePoints);
    _startTracking();
  }

  void _startTracking() {
    Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high, distanceFilter: 5),
    ).listen((pos) {
      if (!mounted) return;
      final userLatLng = LatLng(pos.latitude, pos.longitude);
      _mapController.move(userLatLng, 17);
      final destLat = widget.street['lat'] as double;
      final destLng = widget.street['lng'] as double;
      final dist = const Distance()
          .as(LengthUnit.Meter, userLatLng, LatLng(destLat, destLng));
      setState(() {
        _currentPos = pos;
        if (dist < 30) _arrived = true;
        _trimRoute(userLatLng);
      });
    });
  }

  void _trimRoute(LatLng userLatLng) {
    if (_remainingRoute.length < 2) return;
    int closestIdx = 0;
    double closestDist = double.infinity;
    for (int i = 0; i < _remainingRoute.length; i++) {
      final d =
          const Distance().as(LengthUnit.Meter, userLatLng, _remainingRoute[i]);
      if (d < closestDist) {
        closestDist = d;
        closestIdx = i;
      }
    }
    if (closestIdx > 0) _remainingRoute = _remainingRoute.sublist(closestIdx);
  }

  @override
  Widget build(BuildContext context) {
    final destLat = widget.street['lat'] as double;
    final destLng = widget.street['lng'] as double;
    final startCenter = _currentPos != null
        ? LatLng(_currentPos!.latitude, _currentPos!.longitude)
        : const LatLng(_entranceLat, _entranceLng);

    return Scaffold(
      backgroundColor: const Color(0xFF1A1D2E),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(initialCenter: startCenter, initialZoom: 17),
            children: [
              TileLayer(
                urlTemplate:
                    'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${AppConfig.mapboxToken}',
                userAgentPackageName: 'com.hoacheteau.app',
              ),
              if (_remainingRoute.length >= 2)
                PolylineLayer(polylines: [
                  Polyline(
                      points: _remainingRoute,
                      color: chateuPrimary,
                      strokeWidth: 6,
                      borderColor: Colors.white,
                      borderStrokeWidth: 2),
                ]),
              MarkerLayer(markers: [
                if (_currentPos != null)
                  Marker(
                    point:
                        LatLng(_currentPos!.latitude, _currentPos!.longitude),
                    width: 28,
                    height: 28,
                    child: _UserDot(),
                  ),
                Marker(
                  point: LatLng(destLat, destLng),
                  width: 44,
                  height: 52,
                  alignment: Alignment.topCenter,
                  child:
                      _DestinationPin(label: widget.street['label'] as String),
                ),
              ]),
            ],
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.only(
                  top: MediaQuery.of(context).padding.top + 8,
                  left: 12,
                  right: 12,
                  bottom: 12),
              color: const Color(0xFF1A1D2E).withAlpha(220),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: Colors.white, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.street['label'] as String,
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 16)),
                        if (widget.routeDuration != null &&
                            widget.routeDistance != null)
                          Text(
                              '${widget.routeDuration} · ${widget.routeDistance}',
                              style: const TextStyle(
                                  color: Colors.white70, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_arrived)
            Positioned.fill(
              child: Container(
                color: Colors.black.withAlpha(160),
                child: Center(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 32),
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20)),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.check_circle_rounded,
                            color: chateuPrimary, size: 56),
                        const SizedBox(height: 12),
                        const Text('You have arrived!',
                            style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF1A1D2E))),
                        const SizedBox(height: 6),
                        Text(widget.street['label'] as String,
                            style: const TextStyle(
                                fontSize: 14, color: Colors.grey),
                            textAlign: TextAlign.center),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () => Navigator.pop(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: chateuPrimary,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('Done',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Web Map ───────────────────────────────────────────────────────────────────

class _WebMap extends StatefulWidget {
  final Map<String, dynamic>? selectedStreet;
  final Position? userPosition;
  final List<LatLng> routePoints;
  final List<Map<String, dynamic>> filteredStreets;
  final ValueChanged<Map<String, dynamic>> onStreetSelected;
  final ValueChanged<VoidCallback> onRegisterCenterSubdivision;
  final ValueChanged<VoidCallback> onRegisterCenterUser;

  const _WebMap({
    this.selectedStreet,
    this.userPosition,
    required this.routePoints,
    required this.filteredStreets,
    required this.onStreetSelected,
    required this.onRegisterCenterSubdivision,
    required this.onRegisterCenterUser,
  });

  @override
  State<_WebMap> createState() => _WebMapState();
}

class _WebMapState extends State<_WebMap> {
  final MapController _mapController = MapController();

  @override
  void initState() {
    super.initState();
    widget.onRegisterCenterSubdivision(
      () => _mapController.move(
          const LatLng(_subdivisionLat, _subdivisionLng), 16),
    );
    widget.onRegisterCenterUser(() {
      if (widget.userPosition != null) {
        _mapController.move(
            LatLng(
                widget.userPosition!.latitude, widget.userPosition!.longitude),
            17);
      }
    });
  }

  @override
  void didUpdateWidget(_WebMap old) {
    super.didUpdateWidget(old);
    if (widget.selectedStreet != null &&
        widget.selectedStreet != old.selectedStreet) {
      _mapController.move(
          LatLng(widget.selectedStreet!['lat'] as double,
              widget.selectedStreet!['lng'] as double),
          17);
    }
    if (widget.routePoints.isNotEmpty &&
        widget.routePoints != old.routePoints) {
      _fitRouteBounds();
    }
    // Re-register user-center callback so closure captures fresh userPosition
    if (widget.userPosition != old.userPosition) {
      widget.onRegisterCenterUser(() {
        if (widget.userPosition != null) {
          _mapController.move(
              LatLng(widget.userPosition!.latitude,
                  widget.userPosition!.longitude),
              17);
        }
      });
    }
  }

  void _fitRouteBounds() {
    if (widget.routePoints.length < 2) return;
    final bounds = LatLngBounds.fromPoints(widget.routePoints);
    _mapController.fitCamera(
        CameraFit.bounds(bounds: bounds, padding: const EdgeInsets.all(48)));
  }

  @override
  Widget build(BuildContext context) {
    final hasRoute = widget.selectedStreet != null;
    final destLat = widget.selectedStreet?['lat'] as double? ?? _subdivisionLat;
    final destLng = widget.selectedStreet?['lng'] as double? ?? _subdivisionLng;

    return FlutterMap(
      mapController: _mapController,
      options: const MapOptions(
          initialCenter: LatLng(_subdivisionLat, _subdivisionLng),
          initialZoom: 16),
      children: [
        TileLayer(
          urlTemplate:
              'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${AppConfig.mapboxToken}',
          userAgentPackageName: 'com.hoacheteau.app',
        ),
        if (widget.routePoints.length >= 2)
          PolylineLayer(polylines: [
            Polyline(
                points: widget.routePoints,
                color: chateuPrimary,
                strokeWidth: 5,
                borderColor: Colors.white,
                borderStrokeWidth: 2),
          ]),
        MarkerLayer(markers: [
          Marker(
            point: const LatLng(_entranceLat, _entranceLng),
            width: 120,
            height: 52,
            alignment: Alignment.topCenter,
            child: const _LandmarkPin(emoji: '🏰', label: 'Entrance'),
          ),
          Marker(
            point: const LatLng(_coveredCourtLat, _coveredCourtLng),
            width: 150,
            height: 52,
            alignment: Alignment.topCenter,
            child: const _LandmarkPin(emoji: '🏟', label: 'Covered Court'),
          ),
          Marker(
            point: const LatLng(_hoaOfficeLat, _hoaOfficeLng),
            width: 135,
            height: 52,
            alignment: Alignment.topCenter,
            child: const _LandmarkPin(emoji: '🏢', label: 'HOA Office'),
          ),
          if (widget.userPosition != null)
            Marker(
              point: LatLng(widget.userPosition!.latitude,
                  widget.userPosition!.longitude),
              width: 28,
              height: 28,
              child: _UserDot(),
            ),
          ...widget.filteredStreets.map((s) => Marker(
                point: LatLng(s['lat'] as double, s['lng'] as double),
                width: 28,
                height: 34,
                alignment: Alignment.topCenter,
                child: GestureDetector(
                  onTap: () => widget.onStreetSelected(s),
                  child: _LotPin(selected: widget.selectedStreet == s),
                ),
              )),
          if (hasRoute)
            Marker(
              point: LatLng(destLat, destLng),
              width: 160,
              height: 56,
              alignment: Alignment.topCenter,
              child: _DestinationPin(
                  label: widget.selectedStreet!['label'] as String),
            ),
        ]),
      ],
    );
  }
}

// ── Mobile Map ────────────────────────────────────────────────────────────────

class _MobileMap extends StatefulWidget {
  final Map<String, dynamic>? selectedStreet;
  final Position? userPosition;
  final List<LatLng> routePoints;
  final List<Map<String, dynamic>> filteredStreets;
  final ValueChanged<Position> onLocationReady;
  final ValueChanged<Map<String, dynamic>> onStreetSelected;
  final ValueChanged<VoidCallback> onRegisterCenterSubdivision;
  final ValueChanged<VoidCallback> onRegisterCenterUser;

  const _MobileMap({
    this.selectedStreet,
    this.userPosition,
    required this.routePoints,
    required this.filteredStreets,
    required this.onLocationReady,
    required this.onStreetSelected,
    required this.onRegisterCenterSubdivision,
    required this.onRegisterCenterUser,
  });

  @override
  State<_MobileMap> createState() => _MobileMapState();
}

class _MobileMapState extends State<_MobileMap> {
  final _mapController = MapController();

  @override
  void initState() {
    super.initState();
    widget.onRegisterCenterSubdivision(
      () => _mapController.move(
          const LatLng(_subdivisionLat, _subdivisionLng), 16.5),
    );
    widget.onRegisterCenterUser(() {
      if (widget.userPosition != null) {
        _mapController.move(
            LatLng(
                widget.userPosition!.latitude, widget.userPosition!.longitude),
            17);
      }
    });
  }

  @override
  void didUpdateWidget(_MobileMap old) {
    super.didUpdateWidget(old);
    if (widget.selectedStreet != null &&
        widget.selectedStreet != old.selectedStreet) {
      final lat = widget.selectedStreet!['lat'] as double;
      final lng = widget.selectedStreet!['lng'] as double;
      _mapController.move(LatLng(lat, lng), 18.5);
    }
    if (widget.routePoints.isNotEmpty &&
        widget.routePoints != old.routePoints &&
        widget.routePoints.length >= 2) {
      final bounds = LatLngBounds.fromPoints(widget.routePoints);
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: bounds,
          padding: const EdgeInsets.all(60),
        ),
      );
    }
    // Re-register user-center callback so closure captures fresh userPosition
    if (widget.userPosition != old.userPosition) {
      widget.onRegisterCenterUser(() {
        if (widget.userPosition != null) {
          _mapController.move(
              LatLng(widget.userPosition!.latitude,
                  widget.userPosition!.longitude),
              17);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.selectedStreet;
    final destLat = selected?['lat'] as double?;
    final destLng = selected?['lng'] as double?;
    final isLandmark = selected?['isLandmark'] == true;

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: const LatLng(_subdivisionLat, _subdivisionLng),
        initialZoom: 16.5,
        minZoom: 14,
        maxZoom: 20,
      ),
      children: [
        // Tiles
        TileLayer(
          urlTemplate:
              'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${AppConfig.mapboxToken}',
          userAgentPackageName: 'com.hoacheteau.app',
        ),

        // Route
        if (widget.routePoints.length >= 2)
          PolylineLayer(polylines: [
            Polyline(
              points: widget.routePoints,
              color: chateuPrimary,
              strokeWidth: 5,
              borderColor: Colors.white,
              borderStrokeWidth: 1.5,
            ),
          ]),

        // Markers
        MarkerLayer(
          rotate: false,
          markers: [
            // All lots + landmarks
            ...widget.filteredStreets.map((s) {
              final lat = s['lat'] as double;
              final lng = s['lng'] as double;
              final isLm = s['isLandmark'] == true;
              final isSelected = selected != null &&
                  selected['lat'] == lat &&
                  selected['lng'] == lng;

              if (isLm) {
                return Marker(
                  point: LatLng(lat, lng),
                  width: 140,
                  height: 56,
                  alignment: Alignment.topCenter,
                  child: GestureDetector(
                    onTap: () => widget.onStreetSelected(s),
                    child: _LandmarkPin(
                      label: s['label'] as String,
                      emoji: s['emoji'] as String? ?? '📍',
                    ),
                  ),
                );
              }

              return Marker(
                point: LatLng(lat, lng),
                width: isSelected ? 44 : 28,
                height: isSelected ? 54 : 34,
                alignment: Alignment.bottomCenter,
                child: GestureDetector(
                  onTap: () => widget.onStreetSelected(s),
                  child: _LotPin(selected: isSelected),
                ),
              );
            }),

            // User location
            if (widget.userPosition != null)
              Marker(
                point: LatLng(
                  widget.userPosition!.latitude,
                  widget.userPosition!.longitude,
                ),
                width: 22,
                height: 22,
                child: _UserDot(),
              ),

            // Destination pin (selected non-landmark)
            if (destLat != null && destLng != null && !isLandmark)
              Marker(
                point: LatLng(destLat, destLng),
                width: 44,
                height: 54,
                alignment: Alignment.bottomCenter,
                child: const _LotPin(selected: true),
              ),
          ],
        ),
      ],
    );
  }
}

// ── Flutter Map marker widgets (Web + NavigationPage) ────────────────────────

class _UserDot extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final paint = Paint();
    paint.color = chateuPrimary;
    return Container(
      decoration: BoxDecoration(
        color: chateuPrimary,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: [
          BoxShadow(
              color: chateuPrimary.withAlpha(120),
              blurRadius: 10,
              spreadRadius: 3)
        ],
      ),
    );
  }
}

class _LotPin extends StatelessWidget {
  final bool selected;
  const _LotPin({this.selected = false});

  @override
  Widget build(BuildContext context) {
    final color = selected ? Colors.orange : chateuPrimary;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: selected ? 14 : 10,
          height: selected ? 14 : 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: [
              BoxShadow(
                  color: color.withAlpha(150), blurRadius: 6, spreadRadius: 1)
            ],
          ),
        ),
        Container(width: 2, height: 6, color: color),
      ],
    );
  }
}

class _LandmarkPin extends StatelessWidget {
  final String emoji;
  final String label;
  const _LandmarkPin({required this.emoji, required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1D2E),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: chateuPrimary, width: 1.5),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withAlpha(60),
                  blurRadius: 6,
                  offset: const Offset(0, 2))
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 13)),
              const SizedBox(width: 4),
              Text(label,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600)),
            ],
          ),
        ),
        _PinTip(color: const Color(0xFF1A1D2E)),
      ],
    );
  }
}

class _DestinationPin extends StatelessWidget {
  final String label;
  const _DestinationPin({required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          constraints: const BoxConstraints(maxWidth: 150),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.red,
            borderRadius: BorderRadius.circular(10),
            boxShadow: [
              BoxShadow(
                  color: Colors.red.withAlpha(80),
                  blurRadius: 8,
                  offset: const Offset(0, 3))
            ],
          ),
          child: Text(label,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis,
              maxLines: 1),
        ),
        const _PinTip(color: Colors.red),
      ],
    );
  }
}

class _PinTip extends StatelessWidget {
  final Color color;
  const _PinTip({required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 10,
      height: 6,
      decoration: BoxDecoration(
        color: color,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(3),
          bottomRight: Radius.circular(3),
        ),
      ),
    );
  }
}

// ── Utility widgets ───────────────────────────────────────────────────────────

class _Fab extends StatelessWidget {
  final IconData icon;
  const _Fab({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(30),
              blurRadius: 8,
              offset: const Offset(0, 3))
        ],
      ),
      child: Icon(icon, color: chateuPrimary, size: 22),
    );
  }
}

class _SearchBar extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  const _SearchBar({required this.controller, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(40),
              blurRadius: 14,
              offset: const Offset(0, 4))
        ],
      ),
      child: TextField(
        controller: controller,
        autofocus: true,
        style: const TextStyle(color: Color(0xFF1A1D2E), fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Search street or lot…',
          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
          prefixIcon:
              const Icon(Icons.search_rounded, color: chateuPrimary, size: 20),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        onChanged: onChanged,
      ),
    );
  }
}

class _ResultsList extends StatelessWidget {
  final List<Map<String, dynamic>> results;
  final ValueChanged<Map<String, dynamic>> onTap;
  const _ResultsList({required this.results, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(25),
              blurRadius: 10,
              offset: const Offset(0, 4))
        ],
      ),
      child: Column(
        children: results
            .map((r) => ListTile(
                  dense: true,
                  leading: const Icon(Icons.location_on_rounded,
                      color: chateuPrimary, size: 18),
                  title: Text(r['label'] as String,
                      style: const TextStyle(
                          fontSize: 13, color: Color(0xFF1A1D2E))),
                  subtitle: Text(r['street'] as String? ?? '',
                      style: const TextStyle(fontSize: 11, color: Colors.grey)),
                  onTap: () => onTap(r),
                ))
            .toList(),
      ),
    );
  }
}
