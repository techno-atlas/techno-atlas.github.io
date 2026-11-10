/* Configuration des comptes personnels.
   Laisser vide pour désactiver les comptes (le site fonctionne alors en mode « navigateur seul »).
   - supabaseUrl : l'URL du projet Supabase.
   - supabaseKey : la clé « publishable » (publique par conception : elle ne donne accès à rien
     sans les règles RLS du schéma supabase/schema.sql).
   NE JAMAIS y mettre une clé « secret » / « service_role » ni un mot de passe. */
/* movedTo : renseigné UNIQUEMENT dans la copie de l'ancienne adresse, pour afficher un bandeau « ce site a déménagé ». */
window.ATLAS_CONFIG = {
  movedTo: '',
  supabaseUrl: 'https://leqdpxfhognvevwlvgtk.supabase.co',
  supabaseKey: 'sb_publishable_0PcqtgVpZyeMSLgEC2DQfw_0xzkm2qA'
};
