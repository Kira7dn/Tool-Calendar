/* eslint-disable */
/**
 * Utility for handling Web Push Notifications
 */
/* global Notification, btoa */

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    console.log('[ServiceWorker] Registered with scope:', registration.scope)
    return registration
  } catch (error) {
    console.error('[ServiceWorker] Registration failed:', error)
    return null
  }
}

export async function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission === 'granted') {
    await subscribeUserToPush()
  }
  return permission
}

export async function subscribeUserToPush() {
  try {
    const registration = await navigator.serviceWorker.ready

    // Get VAPID public key from server
    const keyResponse = await fetch('/api/notification/vapid-public-key', {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
    })

    if (!keyResponse.ok) throw new Error('Failed to fetch VAPID key')
    const { publicKey } = await keyResponse.json()

    // Check if we already have a subscription with this key
    const existingSubscription = await registration.pushManager.getSubscription()
    const lastKey = localStorage.getItem('push_vapid_key')

    if (existingSubscription && lastKey === publicKey) {
      console.log('[Push] Already subscribed with current key')
      return true
    }

    // If key changed, unsubscribe first
    if (existingSubscription && lastKey !== publicKey) {
      console.log('[Push] Key mismatch, re-subscribing...')
      await existingSubscription.unsubscribe()
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    const p256dh = btoa(
      String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))
    )
    const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))

    // Send subscription to server
    const response = await fetch('/api/notification/subscribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      }),
    })

    if (response.ok) {
      localStorage.setItem('push_vapid_key', publicKey)
    }

    return response.ok
  } catch (error) {
    console.error('[Push] Subscription failed:', error)
    return false
  }
}

export async function unsubscribeUserFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()
      // Optionally notify server to remove subscription
      await fetch('/api/notification/unsubscribe', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
    }
    return true
  } catch (error) {
    console.error('[Push] Unsubscription failed:', error)
    return false
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
