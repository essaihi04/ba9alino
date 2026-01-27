import { useState } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ResetAppButton() {
  const [isResetting, setIsResetting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleResetApp = async () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    const finalConfirm = prompt(
      '⚠️ ATTENTION - Cette action est IRRÉVERSIBLE !\n\n' +
      'Cela va supprimer TOUTES les données de toutes les tables:\n' +
      '• Produits, Catégories, Stock\n' +
      '• Clients, Fournisseurs\n' +
      '• Commandes, Factures, Paiements\n' +
      '• Achats, Notes de crédit, Coupons\n\n' +
      'Pour confirmer, tapez: "SUPPRIMER_TOUT"\n\n' +
      'Cette action ne peut pas être annulée !'
    )

    if (finalConfirm !== 'SUPPRIMER_TOUT') {
      alert('Texte de confirmation incorrect. Opération annulée.')
      setShowConfirm(false)
      return
    }

    setIsResetting(true)

    try {
      // Tables à vider dans l'ordre pour respecter les contraintes de clé étrangère
      const tables = [
        'order_items',
        'invoice_items',
        'payments',
        'invoices',
        'orders',
        'purchases',
        'credit_notes',
        'coupons',
        'stock',
        'products',
        'product_categories',
        'clients',
        'suppliers'
      ]

      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const tableName of tables) {
        try {
          const { error } = await supabase
            .from(tableName)
            .delete() // Supprime tous les enregistrements sans filtre

          if (error) {
            errors.push(`${tableName}: ${error.message}`)
            errorCount++
          } else {
            successCount++
          }
        } catch (err) {
          errors.push(`${tableName}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
          errorCount++
        }
      }

      // Réinitialiser les compteurs auto-incrémentés si possible
      try {
        // Réinitialiser les séquences PostgreSQL
        await supabase.rpc('reset_all_sequences')
      } catch (seqError) {
        console.warn('Impossible de réinitialiser les séquences:', seqError)
      }

      setIsResetting(false)
      setShowConfirm(false)

      if (errorCount === 0) {
        alert(`✅ Succès ! ${successCount} tables ont été vidées complètement.\n\nL'application a été réinitialisée à zéro.\nVeuillez recharger la page.`)
        window.location.reload()
      } else {
        alert(`⚠️ Réinitialisation partielle:\n${successCount} tables vidées avec succès\n${errorCount} erreurs:\n${errors.join('\n')}`)
      }

    } catch (error) {
      setIsResetting(false)
      setShowConfirm(false)
      console.error('Erreur lors de la réinitialisation:', error)
      alert('Une erreur est survenue lors de la réinitialisation de l\'application.')
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={handleResetApp}
        disabled={isResetting}
        className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all ${
          showConfirm
            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg animate-pulse'
            : 'bg-gray-800 hover:bg-gray-900 text-white shadow-md'
        } ${isResetting ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isResetting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Réinitialisation...</span>
          </>
        ) : (
          <>
            {showConfirm ? (
              <AlertTriangle size={18} />
            ) : (
              <Trash2 size={18} />
            )}
            <span>{showConfirm ? 'CONFIRMER SUPPRESSION TOTALE' : 'Réinitialiser App'}</span>
          </>
        )}
      </button>
      
      {showConfirm && (
        <button
          onClick={() => setShowConfirm(false)}
          className="mt-2 w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition"
        >
          Annuler
        </button>
      )}
    </div>
  )
}
