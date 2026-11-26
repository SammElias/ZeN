import type {OfficinaActor} from '../../shared/companion-officina';

// Coordinates belong to the source plates. Gutters and the central corridor
// deliberately have no hit region. The same coordinate system drives the light trail.
export type Point = readonly [number, number];
export type Quad = readonly [Point, Point, Point, Point];
export type Screen = {corners: Quad; side?: boolean; board?: boolean; ambientOnly?: boolean};
export type Room = {outline: Point[]; label: Point; door: Point; screens: Screen[]; foreground?: Point[][]};
export const planSize = [1024,1536] as const;
export const rooms: Record<OfficinaActor, Room> = {
  architect: {
    outline:[[296,114],[651,182],[575,476],[564,496],[337,448],[133,410],[190,268]],
    label:[422,172],door:[549,473],
    screens:[{board:true,corners:[[355,171],[505,199],[505,267],[354,240]]}],
  },
  analyst: {
    outline:[[675,190],[1002,249],[930,547],[584,472],[634,340]],
    label:[812,232],door:[607,465],screens:[{board:true,ambientOnly:true,corners:[[750,239],[890,264],[888,319],[748,294]]}],
  },
  coordinator: {
    outline:[[132,417],[467,487],[468,542],[383,732],[320,750],[15,649],[80,514]],
    label:[261,461],door:[420,645],screens:[{board:true,ambientOnly:true,corners:[[319,597],[344,605],[325,618],[300,609]]}],
  },
  alm: {
    outline:[[721,517],[998,565],[935,851],[634,783],[684,653]],
    label:[851,556],door:[675,703],
    screens:[{corners:[[779,608],[841,622],[838,658],[777,646]]},
      {corners:[[848,625],[907,641],[901,676],[845,659]]},{side:true,corners:[[917,634],[944,649],[936,707],[910,692]]}],
    foreground:[[[790,675],[791,655],[798,651],[799,645],[805,642],[814,642],[821,648],[822,656],[818,664],[824,670],[831,677]]],
  },
  developer: {
    outline:[[68,675],[346,746],[300,949],[268,971],[211,1156],[0,1105],[0,835]],
    label:[187,734],door:[303,922],
    screens:[{corners:[[80,828],[151,799],[153,841],[79,871]]},{corners:[[161,800],[236,816],[235,859],[161,842]]}],
    foreground:[[[152,872],[155,856],[161,851],[168,849],[177,851],[184,859],[186,873]]],
  },
  tester: {
    outline:[[637,792],[998,865],[929,1258],[529,1179],[557,1069],[584,1020]],
    label:[806,868],door:[595,990],
    screens:[{corners:[[757,910],[834,928],[829,986],[752,963]]},{corners:[[844,934],[920,958],[904,1004],[840,980]]}],
    foreground:[[[737,1030],[745,1002],[753,996],[755,977],[760,966],[769,961],[779,962],[786,969],[786,982],[779,986],[783,997],[798,1008]]],
  },
  observer: {
    outline:[[277,942],[558,1004],[508,1197],[470,1220],[218,1149],[233,1060]],
    label:[395,984],door:[428,970],
    screens:[{corners:[[311,1014],[397,1031],[397,1080],[311,1060]]},{corners:[[405,1034],[476,1052],[472,1091],[404,1076]]}],
    foreground:[[[315,1092],[327,1061],[332,1051],[343,1046],[351,1048],[359,1054],[357,1064],[362,1074],[376,1087]]],
  },
};

export type DetailPlate = {size: Point; screens: Screen[]; foreground?: Point[][]};
export const details: Record<OfficinaActor, DetailPlate> = {
  alm: {size:[1086,1448],screens:[
    {corners:[[410,311],[665,310],[663,415],[412,415]]},
    {side:true,corners:[[689,284],[776,298],[763,431],[683,413]]}],
    foreground:[[[540,428],[545,418],[553,411],[562,408],[576,406],[589,409],[598,416],[603,429]]]},
  developer:{size:[472,630],screens:[{corners:[[122,223],[242,212],[242,272],[122,284]]},
    {side:true,corners:[[251,212],[372,227],[372,288],[251,274]]}],
    foreground:[[[214,293],[216,278],[219,268],[225,262],[233,258],[244,258],[254,261],[261,270],[265,283],[266,294]],
    [[118,220],[142,215],[147,211],[152,211],[161,215],[146,222],[119,225]]]},
  architect:{size:[472,630],screens:[{board:true,corners:[[137,83],[308,83],[308,175],[137,175]]}]},
  analyst:{size:[472,630],screens:[{board:true,corners:[[131,118],[249,118],[249,185],[131,185]]}]},
  coordinator:{size:[472,630],screens:[{corners:[[154,88],[338,87],[336,156],[154,156]]}]},
  tester:{size:[472,630],screens:[{corners:[[155,181],[251,174],[250,229],[155,235]]},
    {side:true,corners:[[256,175],[352,187],[351,242],[255,228]]}],
    foreground:[[[217,246],[219,234],[222,228],[228,224],[233,223],[239,224],[244,230],[248,238],[248,247]]]},
  observer:{size:[472,630],screens:[{corners:[[121,151],[232,148],[231,214],[121,215]]},
    {side:true,corners:[[240,149],[351,151],[350,214],[240,213]]}],
    foreground:[[[187,225],[192,207],[193,198],[199,193],[206,189],[215,187],[222,187],[229,191],[233,198],
      [235,205],[239,209],[239,214],[236,216],[239,222],[248,224],[249,229]]]},
};
