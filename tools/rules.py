"""Règles de sécurité de la base temps réel (ancien jeu + nouveau jeu dans v2/).
Téo les colle à la main dans la console Firebase (Realtime Database, onglet Règles)."""
import json

def rules():
    return {'rules': {
        # ---- ancien jeu ----
        'villages': {'.read': 'auth != null', '$uid': {'.write': 'auth != null && auth.uid === $uid'}},
        'dons': {'.read': 'auth != null', '.indexOn': ['to'],
                 '$id': {'.write': "auth != null && (data.exists() ? (data.child('to').val() === auth.uid || data.child('from').val() === auth.uid) : newData.child('from').val() === auth.uid)"}},
        'presence': {'.read': 'auth != null', '$uid': {'.write': 'auth != null && auth.uid === $uid'}},
        'duo': {'inbox': {'$uid': {'.read': 'auth != null && auth.uid === $uid', '$msg': {'.write': 'auth != null'}}},
                'live': {'.read': 'auth != null', '.write': 'auth != null'}},
        'imported': {'.read': 'auth != null', '$k': {'.write': 'auth != null && (!data.exists() || data.val() === auth.uid) && newData.val() === auth.uid'}},
        # ---- nouveau jeu : un village commun pour deux ----
        'v2': {
            'users': {'$uid': {'.read': 'auth != null && auth.uid === $uid', '.write': 'auth != null && auth.uid === $uid'}},
            'invites': {'$vid': {'.read': 'auth != null',
                                 '.write': "auth != null && (!data.exists() || root.child('v2/villages/' + $vid + '/members/' + auth.uid).exists())"}},
            'villages': {'$vid': {
                '.read': 'auth != null && data.child(\'members\').child(auth.uid).exists()',
                '.write': "auth != null && (data.child('members').child(auth.uid).exists() || (!data.exists() && newData.child('members').child(auth.uid).exists()))",
                # la 2e personne s'inscrit seulement si elle a d'abord pris la place libre (v2/seats : les règles ne savent pas compter)
                'members': {'$uid': {'.write': "auth != null && auth.uid === $uid && !data.exists() && data.parent().parent().exists() && root.child('v2/seats/' + $vid).val() === auth.uid"}},
            }},
            # la place de la 2e personne d'un village : prise une seule fois, par quelqu'un qui n'y habite pas déjà
            'seats': {'$vid': {'.read': 'auth != null',
                               '.write': "auth != null && newData.val() === auth.uid && (data.val() === auth.uid || (!data.exists() && root.child('v2/villages/' + $vid).exists() && !root.child('v2/villages/' + $vid + '/members/' + auth.uid).exists()))"}},
            'presence': {'$vid': {'.read': "auth != null && root.child('v2/villages/' + $vid + '/members/' + auth.uid).exists()",
                                  '$uid': {'.write': 'auth != null && auth.uid === $uid'}}},
            # donjons à deux en direct : invitation, état du combat (hôte → invitée), commandes (invitée → hôte)
            'live': {'$vid': {'.read': "auth != null && root.child('v2/villages/' + $vid + '/members/' + auth.uid).exists()",
                              '.write': "auth != null && root.child('v2/villages/' + $vid + '/members/' + auth.uid).exists()"}},
        },
    }}

def write(path):
    json.dump(rules(), open(path, 'w'), indent=2)
