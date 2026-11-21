export const templateAreas = {
  finance:'Compras y finanzas',
  operations:'Operaciones',
  people:'Personas',
  sales:'Ventas y clientes',
  governance:'Cumplimiento y gobierno',
  projects:'Datos y proyectos',
} as const;

const prefix='eb54b1a0-6abd-41be-8d60-';
export const initialEnterpriseTemplateCount=7;

export function enterpriseTemplateId(slot:number) {
  return prefix+String(slot).padStart(12,'0');
}

const catalogAreas=[
  'operations','finance','operations','operations','operations','people','projects',
  'finance','finance','finance','finance',
  'operations','operations','operations','operations',
  'people','people','people','people',
  'sales','sales','sales','sales',
  'governance','governance','governance','governance',
  'projects','projects','projects',
] as const;

const areasById=new Map(catalogAreas.map((area,index)=>[enterpriseTemplateId(index+1),templateAreas[area]]));

export function enterpriseTemplateArea(id:string) {
  return areasById.get(id);
}
