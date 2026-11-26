import type {OfficinaActor} from '../../shared/companion-officina';
import type {Room} from './composition';

// Pixel coordinates on the landscape master. The horizontal aisle and front entrance are neutral.
export const panoramaSize = [1672,941] as const;
export const panoramaHub = [823,460] as const;
export const panoramaRooms: Record<OfficinaActor,Room> = {
  architect: {
    outline:[[173,62],[474,68],[410,405],[48,396],[76,252]], label:[340,351], door:[298,408],
    screens:[{board:true,corners:[[242,103],[415,115],[417,189],[246,177]]}],
  },
  coordinator: {
    outline:[[499,75],[843,83],[801,414],[442,390]], label:[635,356], door:[694,417],
    screens:[{ambientOnly:true,corners:[[682,245],[721,230],[713,253],[676,267]]}],
  },
  analyst: {
    outline:[[861,92],[1205,101],[1191,411],[828,395]], label:[1051,355], door:[940,423],
    screens:[{board:true,ambientOnly:true,corners:[[953,123],[1135,135],[1135,202],[950,192]]}],
  },
  alm: {
    outline:[[1234,108],[1624,123],[1641,414],[1227,409]],label:[1449,363],door:[1390,429],
    screens:[{corners:[[1326,190],[1405,195],[1402,237],[1324,232]]},
      {corners:[[1414,198],[1484,207],[1480,247],[1412,238]]},{side:true,corners:[[1508,191],[1546,207],[1537,271],[1503,258]]}],
    foreground:[[[1354,254],[1358,238],[1368,226],[1381,222],[1390,227],[1393,238],[1391,252],[1380,259]]],
  },
  developer: {
    outline:[[127,463],[536,486],[488,759],[438,798],[47,780],[67,646]],label:[263,746],door:[300,474],
    screens:[{corners:[[188,596],[276,558],[278,610],[191,645]]},{corners:[[286,558],[381,572],[383,622],[287,610]]}],
  },
  observer: {
    outline:[[631,510],[994,522],[989,724],[898,728],[886,816],[679,811],[681,724],[587,721]],label:[825,757],door:[802,507],
    screens:[{corners:[[703,573],[818,581],[818,632],[703,625]]},{corners:[[829,583],[917,590],[918,642],[829,632]]}],
    foreground:[[[729,645],[738,623],[747,615],[759,611],[772,614],[779,624],[783,635],[791,644]]],
  },
  tester: {
    outline:[[1110,497],[1617,521],[1581,816],[1104,804]],label:[1408,749],door:[1327,503],
    screens:[{corners:[[1302,583],[1403,600],[1401,653],[1301,641]]},{corners:[[1416,601],[1519,625],[1514,679],[1415,654]]}],
    foreground:[[[1315,674],[1316,657],[1323,646],[1333,639],[1347,638],[1356,645],[1356,657],[1349,667],[1340,677]]],
  },
};
