import json
import sys

def parse_pgerd(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    nodes = {}
    for node_data in data['data']['layers'][1]['models'].values():
        table_id = node_data['id']
        table_name = node_data['name']
        if table_name == 'Untitled':
            # pgAdmin sometimes stores name in otherInfo.data.name
            try:
                table_name = node_data['otherInfo']['data']['name']
            except:
                pass
        
        columns = []
        try:
            for col in node_data['otherInfo']['data']['columns']:
                columns.append({
                    'name': col['name'],
                    'type': col['typname'],
                    'is_pk': col.get('is_pk', False)
                })
        except:
            pass
        
        nodes[table_id] = {
            'name': table_name,
            'columns': columns
        }
        
    links = []
    for link_data in data['data']['layers'][0]['models'].values():
        source_id = link_data['source']
        target_id = link_data['target']
        links.append((source_id, target_id))
        
    # ERD
    print("```mermaid")
    print("erDiagram")
    for t_id, t_info in nodes.items():
        if not t_info['name']: continue
        print(f"    {t_info['name']} {{")
        for col in t_info['columns']:
            pk_str = " PK" if col['is_pk'] else ""
            # remove spaces from type names for mermaid
            ctype = col['type'].replace(' ', '_')
            print(f"        {ctype} {col['name']}{pk_str}")
        print("    }")
        
    for s_id, t_id in links:
        if s_id in nodes and t_id in nodes:
            s_name = nodes[s_id]['name']
            t_name = nodes[t_id]['name']
            if s_name and t_name:
                print(f"    {s_name} ||--o{{ {t_name} : \"\"")
    print("```")
    
    print("\n\n```mermaid")
    print("classDiagram")
    for t_id, t_info in nodes.items():
        if not t_info['name']: continue
        print(f"    class {t_info['name']} {{")
        for col in t_info['columns']:
            ctype = col['type'].replace(' ', '_')
            print(f"        +{ctype} {col['name']}")
        print("    }")
        
    for s_id, t_id in links:
        if s_id in nodes and t_id in nodes:
            s_name = nodes[s_id]['name']
            t_name = nodes[t_id]['name']
            if s_name and t_name:
                print(f"    {s_name} \"1\" --> \"*\" {t_name} : has")
    print("```")

if __name__ == '__main__':
    parse_pgerd(sys.argv[1])
