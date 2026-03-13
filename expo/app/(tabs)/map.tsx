import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator,
  Animated,
  TextInput,
  Image as RNImage,
  Linking,
  ActionSheetIOS,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Star,
  MapPin,
  ChevronUp,
  ChevronDown,
  Navigation,
  Crosshair,
  Search,
  X,
  Eye,
  EyeOff,
  Users,
  Store,
  UtensilsCrossed,
  Radio,
  Calendar,
  Clock,
  Check,
  Send,
  UserPlus,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import PinoxiaLogo from "@/components/PinoxiaLogo";
import { useRestaurants } from "@/providers/RestaurantProvider";
import { useLocation, getDistanceKm, formatDistance } from "@/providers/LocationProvider";
import type { UserLocation, FriendLocation } from "@/providers/LocationProvider";
import { Heart } from "lucide-react-native";
import { useFriends } from "@/providers/FriendsProvider";
import { useEvents } from "@/providers/EventProvider";

import { Restaurant, Friend, EventWithInvitations } from "@/types";

const DEFAULT_REGION = {
  latitude: 25.2854,
  longitude: 51.5310,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

function openNavigation(latitude: number, longitude: number, name: string) {
  const encodedName = encodeURIComponent(name);
  console.log('[MapScreen] Opening navigation to:', name, latitude, longitude);

  const appleMapsUrl = `maps:0,0?q=${encodedName}&ll=${latitude},${longitude}&dirflg=d`;
  const googleMapsUrl = `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`;
  const wazeUrl = `waze://?ll=${latitude},${longitude}&navigate=yes`;
  const uberUrl = `uber://?action=setPickup&dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}&dropoff[nickname]=${encodedName}`;
  const grabUrl = `grab://open?screenType=BOOKING&pickUpLatLng=&dropOffLatLng=${latitude},${longitude}&dropOffName=${encodedName}`;

  if (Platform.OS === 'ios') {
    const checkApps = async () => {
      const options: string[] = ['Apple Maps'];
      const urls: string[] = [appleMapsUrl];

      try {
        const hasGoogle = await Linking.canOpenURL(googleMapsUrl);
        if (hasGoogle) {
          options.push('Google Maps');
          urls.push(googleMapsUrl);
        }
      } catch (e) {
        console.log('[MapScreen] Google Maps check failed:', e);
      }

      try {
        const hasWaze = await Linking.canOpenURL(wazeUrl);
        if (hasWaze) {
          options.push('Waze');
          urls.push(wazeUrl);
        }
      } catch (e) {
        console.log('[MapScreen] Waze check failed:', e);
      }

      try {
        const hasUber = await Linking.canOpenURL(uberUrl);
        if (hasUber) {
          options.push('Uber');
          urls.push(uberUrl);
        }
      } catch (e) {
        console.log('[MapScreen] Uber check failed:', e);
      }

      try {
        const hasGrab = await Linking.canOpenURL(grabUrl);
        if (hasGrab) {
          options.push('Grab');
          urls.push(grabUrl);
        }
      } catch (e) {
        console.log('[MapScreen] Grab check failed:', e);
      }

      options.push('Cancel');

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          title: 'Open in...',
          message: `Navigate to ${name}`,
        },
        (buttonIndex) => {
          if (buttonIndex < urls.length) {
            console.log('[MapScreen] Opening navigation app:', options[buttonIndex]);
            void Linking.openURL(urls[buttonIndex]);
          }
        }
      );
    };
    void checkApps();
  } else if (Platform.OS === 'android') {
    const url = `google.navigation:q=${latitude},${longitude}`;
    void Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        void Linking.openURL(url);
      } else {
        void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodedName}`);
      }
    }).catch(() => {
      void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
    });
  } else {
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
  }
}



function MapRestaurantCard({ restaurant, distance }: { restaurant: Restaurant; distance: string | null }) {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={cardStyles.card}
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/restaurant/${restaurant.id}`);
        }}
        testID={`map-card-${restaurant.id}`}
      >
        <Image
          source={{ uri: restaurant.photos[0] }}
          style={cardStyles.image}
          contentFit="cover"
        />
        <View style={cardStyles.info}>
          <Text style={cardStyles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text style={cardStyles.cuisine}>{restaurant.cuisine}</Text>
          <View style={cardStyles.meta}>
            <Star size={11} color={Colors.star} fill={Colors.star} />
            <Text style={cardStyles.rating}>{restaurant.rating}</Text>
            <Text style={cardStyles.reviews}>({restaurant.reviewCount})</Text>
            <View style={cardStyles.dot} />
            <Text style={cardStyles.price}>{restaurant.priceRange}</Text>
            {distance && (
              <>
                <View style={cardStyles.dot} />
                <Navigation size={10} color={Colors.primary} />
                <Text style={cardStyles.distanceText}>{distance}</Text>
              </>
            )}
          </View>
        </View>
        <View style={cardStyles.arrow}>
          <Navigation size={14} color={Colors.primary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function FriendMarkerView({ friend, onLoad }: { friend: FriendLocation; onLoad?: () => void }) {
  const initials = friend.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    if (!friend.avatar && onLoad) {
      onLoad();
    }
  }, [friend.avatar, onLoad]);

  return (
    <View style={friendMarkerStyles.container}>
      <View style={friendMarkerStyles.label}>
        <Text style={friendMarkerStyles.labelName} numberOfLines={1}>{friend.name}</Text>
      </View>
      <View style={friendMarkerStyles.labelArrow} />
      <View style={friendMarkerStyles.avatarRing}>
        {friend.avatar ? (
          <RNImage
            source={{ uri: friend.avatar }}
            style={friendMarkerStyles.avatar}
            resizeMode="cover"
            onLoad={onLoad}
          />
        ) : (
          <View style={friendMarkerStyles.avatarFallback}>
            <Text style={friendMarkerStyles.initials}>{initials}</Text>
          </View>
        )}
        <View style={friendMarkerStyles.onlineDot} />
      </View>
    </View>
  );
}

function FriendMarkerWrapper({
  friend,
  Marker,
  Callout,
  onPress,
}: {
  friend: FriendLocation;
  Marker: any;
  Callout: any;
  onPress?: (friend: FriendLocation) => void;
}) {
  const [trackChanges, setTrackChanges] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setTrackChanges(false);
    }, 500);
  }, []);

  useEffect(() => {
    const fallback = setTimeout(() => {
      setTrackChanges(false);
    }, 3000);
    return () => {
      clearTimeout(fallback);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Marker
      coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
      tracksViewChanges={Platform.OS === 'android' ? false : trackChanges}
      pinColor={Platform.OS === 'android' ? '#3B82F6' : undefined}
      title={Platform.OS === 'android' ? friend.name : undefined}
      onPress={() => {
        console.log("[MapScreen] Friend marker tapped:", friend.name);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (onPress) onPress(friend);
      }}
    >
      {Platform.OS === 'ios' ? (
        <FriendMarkerView friend={friend} onLoad={handleLoad} />
      ) : null}
      <Callout tooltip onPress={() => {
        console.log("[MapScreen] Friend callout tapped:", friend.name);
        if (onPress) onPress(friend);
      }}>
        <View style={markerStyles.calloutSimple}>
          <Text style={markerStyles.calloutSimpleName} numberOfLines={1}>{friend.name}</Text>
        </View>
        <View style={markerStyles.calloutArrow} />
      </Callout>
    </Marker>
  );
}

function FamilyMarkerView({ member, onLoad }: { member: FriendLocation; onLoad?: () => void }) {
  const initials = member.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    if (!member.avatar && onLoad) {
      onLoad();
    }
  }, [member.avatar, onLoad]);

  return (
    <View style={familyMarkerStyles.container}>
      <View style={familyMarkerStyles.label}>
        <Text style={familyMarkerStyles.labelName} numberOfLines={1}>{member.name}</Text>
      </View>
      <View style={familyMarkerStyles.labelArrow} />
      <View style={familyMarkerStyles.avatarRing}>
        {member.avatar ? (
          <RNImage
            source={{ uri: member.avatar }}
            style={familyMarkerStyles.avatar}
            resizeMode="cover"
            onLoad={onLoad}
          />
        ) : (
          <View style={familyMarkerStyles.avatarFallback}>
            <Text style={familyMarkerStyles.initials}>{initials}</Text>
          </View>
        )}
        <View style={familyMarkerStyles.onlineDot} />
      </View>
    </View>
  );
}

function FamilyMarkerWrapper({
  member,
  Marker,
  Callout,
  onPress,
}: {
  member: FriendLocation;
  Marker: any;
  Callout: any;
  onPress?: (member: FriendLocation) => void;
}) {
  const [trackChanges, setTrackChanges] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setTrackChanges(false);
    }, 500);
  }, []);

  useEffect(() => {
    const fallback = setTimeout(() => {
      setTrackChanges(false);
    }, 3000);
    return () => {
      clearTimeout(fallback);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Marker
      coordinate={{ latitude: member.latitude, longitude: member.longitude }}
      tracksViewChanges={Platform.OS === 'android' ? false : trackChanges}
      pinColor={Platform.OS === 'android' ? '#9333EA' : undefined}
      title={Platform.OS === 'android' ? member.name : undefined}
      onPress={() => {
        console.log("[MapScreen] Family marker tapped:", member.name);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (onPress) onPress(member);
      }}
    >
      {Platform.OS === 'ios' ? (
        <FamilyMarkerView member={member} onLoad={handleLoad} />
      ) : null}
      <Callout tooltip onPress={() => {
        console.log("[MapScreen] Family callout tapped:", member.name);
        if (onPress) onPress(member);
      }}>
        <View style={markerStyles.calloutSimple}>
          <Text style={markerStyles.calloutSimpleName} numberOfLines={1}>{member.name}</Text>
        </View>
        <View style={markerStyles.calloutArrow} />
      </Callout>
    </Marker>
  );
}

function EventMarkerView({ event }: { event: EventWithInvitations }) {
  const eventDate = new Date(event.eventDate);
  const now = new Date();
  const timeStr = eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = eventDate.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = eventDate.toDateString() === tomorrow.toDateString();
  const dateLabel = isToday ? `Today, ${timeStr}` : isTomorrow ? `Tomorrow, ${timeStr}` : `${eventDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;

  return (
    <View style={eventMarkerStyles.wrapper}>
      <View style={eventMarkerStyles.nameLabel}>
        <Text style={eventMarkerStyles.nameLabelText} numberOfLines={1}>{event.title}</Text>
      </View>
      <View style={eventMarkerStyles.nameLabelArrow} />
      <View style={eventMarkerStyles.banner}>
        <View style={eventMarkerStyles.bannerIconWrap}>
          <Calendar size={10} color="#fff" />
        </View>
        <Text style={eventMarkerStyles.bannerTitle} numberOfLines={1}>{dateLabel}</Text>
      </View>
      <View style={eventMarkerStyles.bannerArrow} />
      <View style={eventMarkerStyles.pinOuter}>
        <View style={eventMarkerStyles.pinInner}>
          <Calendar size={14} color="#fff" />
        </View>
      </View>
      <View style={eventMarkerStyles.pulseRing} />
    </View>
  );
}

function EventMarkerWrapper({
  event,
  Marker,
  Callout,
  onPress,
}: {
  event: EventWithInvitations;
  Marker: any;
  Callout: any;
  onPress?: (event: EventWithInvitations) => void;
}) {
  const [trackChanges, setTrackChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTrackChanges(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const eventDate = new Date(event.eventDate);
  const now = new Date();
  const isPast = eventDate.getTime() < now.getTime();
  const timeStr = eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = eventDate.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = eventDate.toDateString() === tomorrow.toDateString();
  const dateLabel = isToday ? `Today, ${timeStr}` : isTomorrow ? `Tomorrow, ${timeStr}` : `${eventDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;

  if (isPast) return null;

  console.log('[MapScreen] Rendering event marker:', event.title, 'at', event.latitude, event.longitude);

  if (Platform.OS === 'android') {
    return (
      <Marker
        coordinate={{ latitude: event.latitude, longitude: event.longitude }}
        tracksViewChanges={false}
        pinColor="#10B981"
        title={event.title}
        description={`${event.restaurantName} - ${dateLabel}`}
        zIndex={500}
        onPress={() => {
          console.log('[MapScreen] Event marker tapped:', event.title, event.id);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (onPress) onPress(event);
        }}
      />
    );
  }

  return (
    <Marker
      coordinate={{ latitude: event.latitude, longitude: event.longitude }}
      tracksViewChanges={trackChanges}
      zIndex={500}
      anchor={{ x: 0.5, y: 1 }}
      onPress={() => {
        console.log('[MapScreen] Event marker tapped:', event.title, event.id);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (onPress) onPress(event);
      }}
    >
      <EventMarkerView event={event} />
      <Callout tooltip onPress={() => {
        console.log('[MapScreen] Event callout tapped:', event.title);
        if (onPress) onPress(event);
      }}>
        <View style={eventMarkerStyles.calloutBox}>
          <View style={eventMarkerStyles.calloutHeader}>
            <View style={eventMarkerStyles.calloutIconWrap}>
              <Calendar size={12} color="#10B981" />
            </View>
            <View style={eventMarkerStyles.calloutInfo}>
              <Text style={eventMarkerStyles.calloutTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={eventMarkerStyles.calloutSubtitle}>{event.restaurantName}</Text>
            </View>
          </View>
          <Text style={eventMarkerStyles.calloutDate}>{dateLabel}</Text>
          <Text style={eventMarkerStyles.calloutHint}>Tap for details</Text>
        </View>
        <View style={eventMarkerStyles.calloutArrow} />
      </Callout>
    </Marker>
  );
}

function NativeMapView({
  restaurants,
  userLocation,
  focusedRestaurant,
  centerTrigger,
  distanceMap,
  searchQuery,
  friendLocations,
  familyLocations,
  focusFriendLocation,
  focusFriendTrigger,
  focusedEvent,
  eventFocusTrigger,
  events,
  onFriendMarkerPress,
  onFamilyMarkerPress,
  onMarkerPress,
  onMapPress,
  onLongPress,
  onEventMarkerPress,
}: {
  restaurants: Restaurant[];
  userLocation: UserLocation | null;
  focusedRestaurant: Restaurant | null;
  centerTrigger: number;
  distanceMap: Map<string, string>;
  searchQuery: string;
  friendLocations: FriendLocation[];
  familyLocations: FriendLocation[];
  focusFriendLocation: FriendLocation | null;
  focusFriendTrigger: number;
  focusedEvent: EventWithInvitations | null;
  eventFocusTrigger: number;
  events: EventWithInvitations[];
  onFriendMarkerPress?: (friend: FriendLocation) => void;
  onFamilyMarkerPress?: (member: FriendLocation) => void;
  onMarkerPress?: (restaurantId: string) => void;
  onMapPress?: () => void;
  onLongPress?: (coordinate: { latitude: number; longitude: number }) => void;
  onEventMarkerPress?: (event: EventWithInvitations) => void;
}) {
  const MapView =
    require("react-native-maps").default as typeof import("react-native-maps").default;
  const { Marker, Callout, PROVIDER_DEFAULT } =
    require("react-native-maps") as typeof import("react-native-maps");

  const mapRef = useRef<InstanceType<typeof MapView>>(null);
  const hasAnimatedToUser = useRef(false);
  const prevSearchRef = useRef("");

  const initialRegion = focusedRestaurant
    ? {
        latitude: focusedRestaurant.latitude,
        longitude: focusedRestaurant.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }
    : DEFAULT_REGION;

  useEffect(() => {
    if (focusedRestaurant && mapRef.current) {
      console.log("[MapScreen] Animating to focused restaurant:", focusedRestaurant.name);
      mapRef.current.animateToRegion(
        {
          latitude: focusedRestaurant.latitude,
          longitude: focusedRestaurant.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        800
      );
    }
  }, [focusedRestaurant]);

  useEffect(() => {
    if (userLocation && mapRef.current && !hasAnimatedToUser.current && !focusedRestaurant) {
      console.log("[MapScreen] Auto-centering map on user location:", userLocation);
      hasAnimatedToUser.current = true;
      const nearbyRestaurants = restaurants.filter((r) => {
        const latDiff = Math.abs(r.latitude - userLocation.latitude);
        const lonDiff = Math.abs(r.longitude - userLocation.longitude);
        return latDiff < 0.1 && lonDiff < 0.1;
      });
      const delta = nearbyRestaurants.length > 0 ? 0.06 : 0.03;
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        1000
      );
    }
  }, [userLocation, focusedRestaurant, restaurants]);

  useEffect(() => {
    if (centerTrigger > 0 && userLocation && mapRef.current) {
      console.log("[MapScreen] Centering map on user location via button");
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800
      );
    }
  }, [centerTrigger, userLocation]);

  useEffect(() => {
    if (focusFriendLocation && mapRef.current) {
      console.log("[MapScreen] Animating to friend location:", focusFriendLocation.name);
      mapRef.current.animateToRegion(
        {
          latitude: focusFriendLocation.latitude,
          longitude: focusFriendLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800
      );
    }
  }, [focusFriendLocation, focusFriendTrigger]);

  useEffect(() => {
    if (focusedEvent && mapRef.current) {
      console.log("[MapScreen] Animating to focused event:", focusedEvent.title, focusedEvent.latitude, focusedEvent.longitude);
      mapRef.current.animateToRegion(
        {
          latitude: focusedEvent.latitude,
          longitude: focusedEvent.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        800
      );
    }
  }, [focusedEvent, eventFocusTrigger]);

  useEffect(() => {
    if (searchQuery.trim().length > 0 && restaurants.length > 0 && mapRef.current && prevSearchRef.current !== searchQuery) {
      prevSearchRef.current = searchQuery;
      console.log("[MapScreen] Fitting map to search results:", restaurants.length);
      if (restaurants.length === 1) {
        mapRef.current.animateToRegion(
          {
            latitude: restaurants[0].latitude,
            longitude: restaurants[0].longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          800
        );
      } else {
        const lats = restaurants.map((r) => r.latitude);
        const lngs = restaurants.map((r) => r.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const padding = 0.01;
        mapRef.current.animateToRegion(
          {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(maxLat - minLat + padding * 2, 0.01),
            longitudeDelta: Math.max(maxLng - minLng + padding * 2, 0.01),
          },
          800
        );
      }
    }
    if (searchQuery.trim().length === 0) {
      prevSearchRef.current = "";
    }
  }, [searchQuery, restaurants]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={false}
      customMapStyle={brightMapStyle}
      onPress={() => {
        console.log("[MapScreen] Map background tapped, closing dropdown");
        if (onMapPress) onMapPress();
      }}
      onLongPress={(e: any) => {
        const coord = e.nativeEvent?.coordinate;
        if (coord && onLongPress) {
          console.log("[MapScreen] Long press at:", coord.latitude, coord.longitude);
          onLongPress({ latitude: coord.latitude, longitude: coord.longitude });
        }
      }}
    >
      {restaurants.map((r) => {
        const isSearchResult = searchQuery.trim().length > 0;
        const isFocused = focusedRestaurant?.id === r.id;
        const hasFocused = focusedRestaurant !== null;
        const isUnfocused = hasFocused && !isFocused;
        const dist = distanceMap.get(r.id);
        return (
        <Marker
          key={r.id}
          coordinate={{ latitude: r.latitude, longitude: r.longitude }}
          tracksViewChanges={Platform.OS === 'android' ? false : false}
          zIndex={isFocused ? 999 : isUnfocused ? 1 : 10}
          onPress={() => {
            console.log("[MapScreen] Marker tapped:", r.name, r.id);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (onMarkerPress) onMarkerPress(r.id);
          }}
          pinColor={isSearchResult ? '#2563EB' : isFocused ? '#F59E0B' : Colors.primary}
        >
          {Platform.OS === 'ios' ? (
            <View style={[markerStyles.touchable, isUnfocused && { opacity: 0.4, transform: [{ scale: 0.7 }] }]}>
              <View style={markerStyles.container}>
                <View style={[
                  markerStyles.pin,
                  isFocused && markerStyles.pinFocused,
                  isSearchResult && !hasFocused && markerStyles.pinSearchResult,
                ]}>
                  <MapPin size={isFocused ? 20 : isUnfocused ? 12 : 16} color={Colors.white} />
                </View>
                <View style={[
                  markerStyles.pinTail,
                  isSearchResult && !hasFocused && markerStyles.pinTailSearch,
                  isFocused && { borderTopColor: Colors.star },
                ]} />
                {!isUnfocused && (
                  <View style={[
                    markerStyles.labelContainer,
                    isFocused && markerStyles.labelContainerFocused,
                    isSearchResult && !hasFocused && markerStyles.labelContainerSearch,
                  ]}>
                    <Text style={[markerStyles.labelText, isFocused && { fontSize: 12 }]} numberOfLines={1}>{r.name}</Text>
                    {dist && (
                      <Text style={[
                        markerStyles.labelDistance,
                        !isSearchResult && markerStyles.labelDistanceDefault,
                      ]}>{dist}</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          ) : null}
          <Callout tooltip onPress={() => {
            console.log("[MapScreen] Callout pressed:", r.name);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (onMarkerPress) onMarkerPress(r.id);
          }}>
            <View style={markerStyles.calloutBox}>
              <Text style={markerStyles.calloutTitle} numberOfLines={1}>{r.name}</Text>
              <Text style={markerStyles.calloutSubtitle}>{r.cuisine ?? 'Place'}{dist ? ` · ${dist}` : ''}</Text>
              <Text style={markerStyles.calloutTapHint}>Tap for details & navigation</Text>
            </View>
            <View style={markerStyles.calloutArrowDown} />
          </Callout>
        </Marker>
        );
      })}
      {friendLocations.map((fl) => (
        <FriendMarkerWrapper key={`friend-${fl.userId}`} friend={fl} Marker={Marker} Callout={Callout} onPress={onFriendMarkerPress} />
      ))}
      {familyLocations.map((fl) => (
        <FamilyMarkerWrapper key={`family-${fl.userId}`} member={fl} Marker={Marker} Callout={Callout} onPress={onFamilyMarkerPress} />
      ))}
      {events.map((evt) => (
        <EventMarkerWrapper key={`event-${evt.id}`} event={evt} Marker={Marker} Callout={Callout} onPress={onEventMarkerPress} />
      ))}
    </MapView>
  );
}

function WebMapView({
  restaurants,
  userLocation,
  onMarkerPress,
}: {
  restaurants: Restaurant[];
  userLocation: UserLocation | null;
  onMarkerPress: (id: string) => void;
}) {
  const center = userLocation ?? { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude };
  const bbox = `${center.longitude - 0.04},${center.latitude - 0.03},${center.longitude + 0.04},${center.latitude + 0.03}`;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;

  return (
    <View style={{ flex: 1 }}>
      <iframe
        src={mapUrl}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: 0,
        }}
        title="Map"
      />
      <View style={webListStyles.overlay}>
        <FlatList
          data={restaurants}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={webListStyles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={webListStyles.card}
              activeOpacity={0.8}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onMarkerPress(item.id);
              }}
              testID={`web-pin-${item.id}`}
            >
              <Image
                source={{ uri: item.photos[0] }}
                style={webListStyles.cardImage}
                contentFit="cover"
              />
              <View style={webListStyles.cardInfo}>
                <Text style={webListStyles.cardName} numberOfLines={1}>{item.name}</Text>
                <View style={webListStyles.cardMeta}>
                  <Star size={10} color={Colors.star} fill={Colors.star} />
                  <Text style={webListStyles.cardRating}>{item.rating}</Text>
                  <Text style={webListStyles.cardCuisine}> · {item.cuisine}</Text>
                </View>
                <View style={webListStyles.cardLink}>
                  <MapPin size={10} color={Colors.primary} />
                  <Text style={webListStyles.cardLinkText}>View details</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

interface QuickEventCoord {
  latitude: number;
  longitude: number;
}

const QUICK_TIME_OPTIONS = [
  { label: "In 10 min", minutes: 10 },
  { label: "In 30 min", minutes: 30 },
  { label: "In 1 hour", minutes: 60 },
  { label: "In 2 hours", minutes: 120 },
  { label: "In 3 hours", minutes: 180 },
  { label: "Tomorrow", minutes: 24 * 60 },
];

function QuickEventModal({
  visible,
  coordinate,
  friends,
  onClose,
  onSubmit,
  isCreating,
}: {
  visible: boolean;
  coordinate: QuickEventCoord | null;
  friends: Friend[];
  onClose: () => void;
  onSubmit: (params: {
    title: string;
    eventDate: string;
    invitedFriends: { userId: string; name: string }[];
    coordinate: QuickEventCoord;
  }) => void;
  isCreating: boolean;
}) {
  const [selectedTimeIdx, setSelectedTimeIdx] = useState(1);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedTimeIdx(1);
      setSelectedFriendIds(new Set());
      slideAnim.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 1,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [slideAnim, onClose]);

  const toggleFriend = useCallback((friendId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  }, []);

  const getEventDate = useCallback(() => {
    const now = new Date();
    const offset = QUICK_TIME_OPTIONS[selectedTimeIdx].minutes;
    return new Date(now.getTime() + offset * 60 * 1000);
  }, [selectedTimeIdx]);

  const formattedDate = useMemo(() => {
    const d = getEventDate();
    const today = new Date();
    const isTomorrow = d.getFullYear() !== today.getFullYear() || d.getMonth() !== today.getMonth() || d.getDate() !== today.getDate();
    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (isTomorrow) {
      return `Tomorrow, ${timeStr}`;
    }
    return `Today, ${timeStr}`;
  }, [getEventDate]);

  const handleSubmit = useCallback(() => {
    if (!coordinate) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const eventDate = getEventDate().toISOString();
    const invitedFriends = friends
      .filter((f) => selectedFriendIds.has(f.userId))
      .map((f) => ({ userId: f.userId, name: f.name }));
    console.log("[QuickEvent] Submitting:", { eventDate, invitedFriends: invitedFriends.length });
    onSubmit({
      title: "Let's meet here",
      eventDate,
      invitedFriends,
      coordinate,
    });
  }, [coordinate, getEventDate, friends, selectedFriendIds, onSubmit]);

  if (!visible || !coordinate) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={qeStyles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          style={[
            qeStyles.container,
            {
              opacity: slideAnim,
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0],
                }),
              }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={qeStyles.handle} />

            <View style={qeStyles.headerRow}>
              <View style={qeStyles.headerIcon}>
                <MapPin size={18} color={Colors.primary} />
              </View>
              <View style={qeStyles.headerInfo}>
                <Text style={qeStyles.title}>Let's meet here</Text>
                <Text style={qeStyles.subtitle}>
                  {coordinate.latitude.toFixed(4)}, {coordinate.longitude.toFixed(4)}
                </Text>
              </View>
              <TouchableOpacity
                style={qeStyles.closeBtn}
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={qeStyles.section}>
              <View style={qeStyles.sectionHeader}>
                <Clock size={14} color={Colors.textSecondary} />
                <Text style={qeStyles.sectionTitle}>When</Text>
              </View>
              <View style={qeStyles.timeGrid}>
                {QUICK_TIME_OPTIONS.map((opt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      qeStyles.timeChip,
                      selectedTimeIdx === idx && qeStyles.timeChipActive,
                    ]}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedTimeIdx(idx);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        qeStyles.timeChipText,
                        selectedTimeIdx === idx && qeStyles.timeChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={qeStyles.datePreview}>
                <Calendar size={12} color={Colors.primary} />
                <Text style={qeStyles.datePreviewText}>{formattedDate}</Text>
              </View>
            </View>

            <View style={qeStyles.section}>
              <View style={qeStyles.sectionHeader}>
                <UserPlus size={14} color={Colors.textSecondary} />
                <Text style={qeStyles.sectionTitle}>Invite Friends</Text>
                {selectedFriendIds.size > 0 && (
                  <View style={qeStyles.countBadge}>
                    <Text style={qeStyles.countBadgeText}>{selectedFriendIds.size}</Text>
                  </View>
                )}
              </View>
              {friends.length === 0 ? (
                <Text style={qeStyles.emptyText}>No friends yet. Add friends to invite them!</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={qeStyles.friendsScroll}
                >
                  {friends.map((friend) => {
                    const isSelected = selectedFriendIds.has(friend.userId);
                    const initials = friend.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <TouchableOpacity
                        key={friend.userId}
                        style={[
                          qeStyles.friendChip,
                          isSelected && qeStyles.friendChipActive,
                        ]}
                        onPress={() => toggleFriend(friend.userId)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          qeStyles.friendAvatar,
                          isSelected && qeStyles.friendAvatarActive,
                        ]}>
                          {friend.avatar ? (
                            <RNImage
                              source={{ uri: friend.avatar }}
                              style={qeStyles.friendAvatarImg}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={qeStyles.friendInitials}>{initials}</Text>
                          )}
                          {isSelected && (
                            <View style={qeStyles.checkBadge}>
                              <Check size={8} color="#fff" />
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            qeStyles.friendName,
                            isSelected && qeStyles.friendNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {friend.name.split(" ")[0]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <TouchableOpacity
              style={[
                qeStyles.createBtn,
                isCreating && qeStyles.createBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isCreating}
              activeOpacity={0.8}
              testID="quick-event-create-btn"
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Send size={16} color="#fff" />
                  <Text style={qeStyles.createBtnText}>Create Event</Text>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function MapScreenExport() {
  const insets = useSafeAreaInsets();
  const { restaurants } = useRestaurants();
  const { userLocation, locationLoading, locationError, requestLocation, friendLocations, familyLocations, closeFriendSharingEnabled, setCloseFriendSharingEnabled, familySharingEnabled, setFamilySharingEnabled } = useLocation();
  const { friends } = useFriends();
  const { createEvent, isCreating, events } = useEvents();

  const [showFriendLocations, setShowFriendLocations] = useState(closeFriendSharingEnabled);
  const [showFamilyLocations, setShowFamilyLocations] = useState(familySharingEnabled);
  const [focusFriendLocation, setFocusFriendLocation] = useState<FriendLocation | null>(null);
  const [focusFriendTrigger, setFocusFriendTrigger] = useState(0);
  const closeFriendPulse = useRef(new Animated.Value(0)).current;
  const familyPulse = useRef(new Animated.Value(0)).current;

  const friendListRef = useRef<FlatList>(null);
  const familyListRef = useRef<FlatList>(null);

  const [quickEventCoord, setQuickEventCoord] = useState<QuickEventCoord | null>(null);
  const [showQuickEvent, setShowQuickEvent] = useState(false);

  const distanceMap = useMemo(() => {
    if (!userLocation) return new Map<string, string>();
    const map = new Map<string, string>();
    restaurants.forEach((r) => {
      const km = getDistanceKm(
        userLocation.latitude,
        userLocation.longitude,
        r.latitude,
        r.longitude
      );
      map.set(r.id, formatDistance(km));
    });
    return map;
  }, [userLocation, restaurants]);
  const [listExpanded, setListExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();
  const { focus, eventFocus } = useLocalSearchParams<{ focus?: string; eventFocus?: string }>();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const searchInputRef = useRef<TextInput>(null);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Restaurant | null>(null);
  const selectedPlaceAnim = useRef(new Animated.Value(0)).current;

  const focusedRestaurant = useMemo(
    () => (focus ? restaurants.find((r) => r.id === focus) ?? null : null),
    [focus, restaurants]
  );

  const focusedEvent = useMemo(
    () => (eventFocus ? events.find((e) => e.id === eventFocus) ?? null : null),
    [eventFocus, events]
  );

  const [eventFocusTrigger, setEventFocusTrigger] = useState(0);

  useEffect(() => {
    if (focusedRestaurant) {
      console.log("[MapScreen] Focused on restaurant:", focusedRestaurant.name);
      setListExpanded(true);
      setShowSuggestions(false);
      setSearchFocused(false);
      searchInputRef.current?.blur();
    }
  }, [focusedRestaurant]);

  useEffect(() => {
    if (focusedEvent) {
      console.log("[MapScreen] Focused on event:", focusedEvent.title, focusedEvent.latitude, focusedEvent.longitude);
      setShowSuggestions(false);
      setSearchFocused(false);
      searchInputRef.current?.blur();
      setEventFocusTrigger((prev) => prev + 1);
    }
  }, [focusedEvent]);

  const filteredRestaurants = useMemo(() => {
    if (!searchQuery.trim()) return restaurants;
    const q = searchQuery.toLowerCase();
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.cuisine ?? '').toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q)
    );
  }, [restaurants, searchQuery]);

  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 1) return [];
    const q = searchQuery.toLowerCase();
    return restaurants
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.cuisine ?? "").toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [restaurants, searchQuery]);

  const handleSelectSuggestion = useCallback(
    (restaurant: Restaurant) => {
      console.log("[MapScreen] Search suggestion selected:", restaurant.name);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowSuggestions(false);
      setSearchFocused(false);
      searchInputRef.current?.blur();
      setSearchQuery(restaurant.name);
      router.replace({ pathname: "/(tabs)/map", params: { focus: restaurant.id } });
    },
    [router]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setShowSuggestions(false);
    searchInputRef.current?.blur();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (closeFriendSharingEnabled) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(closeFriendPulse, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(closeFriendPulse, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      closeFriendPulse.setValue(0);
    }
  }, [closeFriendSharingEnabled, closeFriendPulse]);

  useEffect(() => {
    if (familySharingEnabled) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(familyPulse, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(familyPulse, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      familyPulse.setValue(0);
    }
  }, [familySharingEnabled, familyPulse]);

  const handleToggleShareFriends = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newVal = !closeFriendSharingEnabled;
    setCloseFriendSharingEnabled(newVal);
    console.log("[MapScreen] Toggle close friend sharing:", newVal);
  }, [closeFriendSharingEnabled, setCloseFriendSharingEnabled]);

  const handleToggleViewFriends = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFriendLocations((prev) => !prev);
    console.log("[MapScreen] Toggle view close friend locations:", !showFriendLocations);
  }, [showFriendLocations]);

  const handleToggleShareFamily = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newVal = !familySharingEnabled;
    setFamilySharingEnabled(newVal);
    console.log("[MapScreen] Toggle family sharing:", newVal);
  }, [familySharingEnabled, setFamilySharingEnabled]);

  const handleToggleViewFamily = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFamilyLocations((prev) => !prev);
    console.log("[MapScreen] Toggle view family locations:", !showFamilyLocations);
  }, [showFamilyLocations]);

  const visibleFriendLocations = useMemo(() => {
    if (!showFriendLocations) {
      console.log("[MapScreen] Friend locations hidden by user toggle");
      return [];
    }
    console.log("[MapScreen] Friend locations to display:", friendLocations.length, friendLocations.map(f => ({ name: f.name, lat: f.latitude, lng: f.longitude })));
    return friendLocations;
  }, [showFriendLocations, friendLocations]);

  const visibleFamilyLocations = useMemo(() => {
    if (!showFamilyLocations) {
      console.log("[MapScreen] Family locations hidden by user toggle");
      return [];
    }
    console.log("[MapScreen] Family locations to display:", familyLocations.length, familyLocations.map(f => ({ name: f.name, lat: f.latitude, lng: f.longitude })));
    return familyLocations;
  }, [showFamilyLocations, familyLocations]);

  const handleFocusFriend = useCallback((friend: FriendLocation) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowSuggestions(false);
    searchInputRef.current?.blur();
    setFocusFriendLocation(friend);
    setFocusFriendTrigger((prev) => prev + 1);
    setShowFriendLocations(true);
    console.log("[MapScreen] Focusing on friend:", friend.name, friend.latitude, friend.longitude);
    const idx = visibleFriendLocations.findIndex((f) => f.userId === friend.userId);
    if (idx >= 0 && friendListRef.current) {
      try {
        friendListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      } catch (e) {
        console.log("[MapScreen] scrollToIndex fallback", e);
        friendListRef.current.scrollToOffset({ offset: idx * 78, animated: true });
      }
    }
  }, [visibleFriendLocations]);

  const handleFocusFamily = useCallback((member: FriendLocation) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowSuggestions(false);
    searchInputRef.current?.blur();
    setFocusFriendLocation(member);
    setFocusFriendTrigger((prev) => prev + 1);
    setShowFamilyLocations(true);
    console.log("[MapScreen] Focusing on family member:", member.name, member.latitude, member.longitude);
    const idx = visibleFamilyLocations.findIndex((f) => f.userId === member.userId);
    if (idx >= 0 && familyListRef.current) {
      try {
        familyListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      } catch (e) {
        console.log("[MapScreen] family scrollToIndex fallback", e);
        familyListRef.current.scrollToOffset({ offset: idx * 78, animated: true });
      }
    }
  }, [visibleFamilyLocations]);

  const handleMapPress = useCallback(() => {
    console.log("[MapScreen] Map pressed, closing dropdown");
    setShowSuggestions(false);
    searchInputRef.current?.blur();
  }, []);

  const handleMarkerPress = useCallback(
    (restaurantId: string) => {
      console.log("[MapScreen] Marker pressed:", restaurantId);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowSuggestions(false);
      searchInputRef.current?.blur();
      const place = restaurants.find((r) => r.id === restaurantId) ?? null;
      setSelectedPlace(place);
      if (place) {
        selectedPlaceAnim.setValue(0);
        Animated.spring(selectedPlaceAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }).start();
      }
    },
    [restaurants, selectedPlaceAnim]
  );

  const handleDismissSelected = useCallback(() => {
    Animated.timing(selectedPlaceAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedPlace(null));
  }, [selectedPlaceAnim]);

  const handleNavigateToPlace = useCallback((place: Restaurant) => {
    console.log("[MapScreen] Navigate to place:", place.name);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowSuggestions(false);
    searchInputRef.current?.blur();
    openNavigation(place.latitude, place.longitude, place.name);
  }, []);

  const handleViewDetails = useCallback((place: Restaurant) => {
    console.log("[MapScreen] View details:", place.name);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSuggestions(false);
    searchInputRef.current?.blur();
    setSelectedPlace(null);
    router.push(`/restaurant/${place.id}`);
  }, [router]);

  const handleEventMarkerPress = useCallback((event: EventWithInvitations) => {
    console.log('[MapScreen] Event marker pressed:', event.id);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowSuggestions(false);
    searchInputRef.current?.blur();
    router.push(`/event/${event.id}`);
  }, [router]);

  const handleMapLongPress = useCallback((coordinate: { latitude: number; longitude: number }) => {
    console.log("[MapScreen] Long press detected at:", coordinate);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setQuickEventCoord(coordinate);
    setShowQuickEvent(true);
    setShowSuggestions(false);
    searchInputRef.current?.blur();
  }, []);

  const handleQuickEventClose = useCallback(() => {
    console.log("[MapScreen] Quick event modal closed");
    setShowQuickEvent(false);
    setQuickEventCoord(null);
  }, []);

  const handleQuickEventSubmit = useCallback(async (params: {
    title: string;
    eventDate: string;
    invitedFriends: { userId: string; name: string }[];
    coordinate: QuickEventCoord;
  }) => {
    console.log("[MapScreen] Creating quick event:", params);
    try {
      await createEvent({
        title: params.title,
        description: "Quick meetup created from the map",
        eventType: "dinner",
        restaurantName: "Dropped Pin",
        latitude: params.coordinate.latitude,
        longitude: params.coordinate.longitude,
        eventDate: params.eventDate,
        invitedFriendIds: params.invitedFriends,
      });
      console.log("[MapScreen] Quick event created successfully");
      setShowQuickEvent(false);
      setQuickEventCoord(null);
      Alert.alert("Event Created!", "Your meetup has been created and invitations sent.");
    } catch (err: any) {
      console.warn("[MapScreen] Quick event creation failed:", err?.message);
      Alert.alert("Error", err?.message ?? "Failed to create event. Please try again.");
    }
  }, [createEvent]);

  const toggleList = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSuggestions(false);
    searchInputRef.current?.blur();
    setListExpanded((prev) => !prev);
  }, []);

  const renderRestaurantItem = useCallback(
    ({ item }: { item: Restaurant }) => <MapRestaurantCard restaurant={item} distance={distanceMap.get(item.id) ?? null} />,
    [distanceMap]
  );

  return (
    <View style={[styles.container]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <PinoxiaLogo size="small" />
          <View>
            <Text style={styles.headerSubtitle}>
              {restaurants.length} places nearby
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.locateButton,
            locationLoading && styles.locateButtonLoading,
            userLocation && styles.locateButtonActive,
          ]}
          onPress={() => {
            if (userLocation) {
              console.log("[MapScreen] Centering on current location");
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setCenterTrigger((prev) => prev + 1);
            } else {
              void requestLocation();
            }
          }}
          disabled={locationLoading}
          activeOpacity={0.7}
          testID="locate-button"
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Animated.View style={{ transform: [{ scale: userLocation ? pulseAnim : 1 }] }}>
              <Crosshair
                size={16}
                color={userLocation ? Colors.white : Colors.textSecondary}
              />
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={[
          styles.searchBar,
          searchFocused && styles.searchBarFocused,
        ]}>
          <Search size={16} color={searchFocused ? Colors.primary : Colors.textMuted} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search shops, restaurants, services..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setShowSuggestions(text.trim().length > 0);
            }}
            onFocus={() => {
              setSearchFocused(true);
              if (searchQuery.trim().length > 0) setShowSuggestions(true);
            }}
            onBlur={() => {
              setSearchFocused(false);
            }}
            returnKeyType="search"
            onSubmitEditing={() => setShowSuggestions(false)}
            testID="map-search-input"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="map-search-clear"
            >
              <View style={styles.clearButton}>
                <X size={12} color={Colors.white} />
              </View>
            </TouchableOpacity>
          )}
        </View>
        {searchQuery.trim().length > 0 && !showSuggestions && (
          <Text style={styles.searchResultCount}>
            {filteredRestaurants.length} result{filteredRestaurants.length !== 1 ? "s" : ""} found
          </Text>
        )}
      </View>

      {(showSuggestions && searchSuggestions.length > 0) && (
        <View style={suggestStyles.wrapper}>
        <View style={suggestStyles.container}>
          {searchSuggestions.map((item, index) => {
            const dist = distanceMap.get(item.id) ?? null;
            const isShop = (item.cuisine ?? "").toLowerCase().includes("shop") ||
              (item.cuisine ?? "").toLowerCase().includes("store") ||
              (item.cuisine ?? "").toLowerCase().includes("retail") ||
              (item.cuisine ?? "").toLowerCase().includes("market") ||
              (item.cuisine ?? "").toLowerCase().includes("grocery") ||
              (item.cuisine ?? "").toLowerCase().includes("supermarket") ||
              (item.cuisine ?? "").toLowerCase().includes("mall") ||
              (item.cuisine ?? "").toLowerCase().includes("electronics") ||
              (item.cuisine ?? "").toLowerCase().includes("fashion") ||
              (item.cuisine ?? "").toLowerCase().includes("convenience");
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  suggestStyles.item,
                  index < searchSuggestions.length - 1 && suggestStyles.itemBorder,
                ]}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
                testID={`search-suggestion-${item.id}`}
              >
                <View style={[suggestStyles.iconWrap, isShop && suggestStyles.iconWrapShop]}>
                  {isShop ? (
                    <Store size={14} color="#F59E0B" />
                  ) : (
                    <UtensilsCrossed size={14} color={Colors.primary} />
                  )}
                </View>
                <View style={suggestStyles.info}>
                  <Text style={suggestStyles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={suggestStyles.metaRow}>
                    <Text style={suggestStyles.cuisine} numberOfLines={1}>
                      {item.cuisine ?? "Place"}
                    </Text>
                    {dist && (
                      <>
                        <View style={suggestStyles.dot} />
                        <Text style={suggestStyles.distance}>{dist}</Text>
                      </>
                    )}
                  </View>
                </View>
                <Navigation size={12} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          })}
          {filteredRestaurants.length > 6 && (
            <View style={suggestStyles.moreRow}>
              <Text style={suggestStyles.moreText}>
                +{filteredRestaurants.length - 6} more results
              </Text>
            </View>
          )}
        </View>
        </View>
      )}

      {showSuggestions && searchSuggestions.length === 0 && searchQuery.trim().length > 0 && (
        <View style={suggestStyles.wrapper}>
        <View style={suggestStyles.container}>
          <View style={suggestStyles.emptyRow}>
            <Search size={16} color={Colors.textMuted} />
            <Text style={suggestStyles.emptyText}>No places found for "{searchQuery}"</Text>
          </View>
        </View>
        </View>
      )}

      {userLocation && (
        <View style={styles.locationBanner}>
          <View style={styles.locationDot} />
          <Text style={styles.locationText} numberOfLines={1}>
            {userLocation.placeName ?? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}
          </Text>
        </View>
      )}

      {locationError && (
        <TouchableOpacity style={styles.errorBanner} onPress={requestLocation}>
          <Text style={styles.errorText}>{locationError}</Text>
          <Text style={styles.errorRetry}>Tap to retry</Text>
        </TouchableOpacity>
      )}

      {friends.length > 0 && (
        <View style={styles.liveLocationSection}>
          <View style={styles.liveLocationRow}>
              <View style={styles.pulseButtonWrapper}>
                {closeFriendSharingEnabled && (
                  <Animated.View
                    style={[
                      styles.friendPulseRing,
                      {
                        opacity: closeFriendPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.7, 0],
                        }),
                        transform: [{
                          scale: closeFriendPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.8],
                          }),
                        }],
                      },
                    ]}
                  />
                )}
                {closeFriendSharingEnabled && (
                  <Animated.View
                    style={[
                      styles.friendPulseRingOuter,
                      {
                        opacity: closeFriendPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 0],
                        }),
                        transform: [{
                          scale: closeFriendPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 2.2],
                          }),
                        }],
                      },
                    ]}
                  />
                )}
                <Animated.View
                  style={closeFriendSharingEnabled ? {
                    transform: [{
                      scale: closeFriendPulse.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 1.05, 1],
                      }),
                    }],
                  } : undefined}
                >
                  <TouchableOpacity
                    style={[
                      styles.shareButton,
                      closeFriendSharingEnabled && styles.shareButtonActiveBlue,
                    ]}
                    onPress={handleToggleShareFriends}
                    activeOpacity={0.7}
                    testID="share-friends-button"
                  >
                    <Radio size={12} color={closeFriendSharingEnabled ? Colors.white : Colors.textSecondary} />
                    <Text style={[
                      styles.shareButtonText,
                      closeFriendSharingEnabled && styles.shareButtonTextActive,
                    ]}>
                      {closeFriendSharingEnabled ? "Sharing Friends" : "Sharing Friends"}
                    </Text>
                    {closeFriendSharingEnabled && <View style={styles.liveDotBlue} />}
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <View style={styles.pulseButtonWrapper}>
                {familySharingEnabled && (
                  <Animated.View
                    style={[
                      styles.familyPulseRing,
                      {
                        opacity: familyPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.7, 0],
                        }),
                        transform: [{
                          scale: familyPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.8],
                          }),
                        }],
                      },
                    ]}
                  />
                )}
                {familySharingEnabled && (
                  <Animated.View
                    style={[
                      styles.familyPulseRingOuter,
                      {
                        opacity: familyPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 0],
                        }),
                        transform: [{
                          scale: familyPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 2.2],
                          }),
                        }],
                      },
                    ]}
                  />
                )}
                <Animated.View
                  style={familySharingEnabled ? {
                    transform: [{
                      scale: familyPulse.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 1.05, 1],
                      }),
                    }],
                  } : undefined}
                >
                  <TouchableOpacity
                    style={[
                      styles.shareButton,
                      familySharingEnabled && styles.shareButtonActivePurple,
                    ]}
                    onPress={handleToggleShareFamily}
                    activeOpacity={0.7}
                    testID="share-family-button"
                  >
                    <Radio size={12} color={familySharingEnabled ? Colors.white : Colors.textSecondary} />
                    <Text style={[
                      styles.shareButtonText,
                      familySharingEnabled && styles.shareButtonTextActive,
                    ]}>
                      {familySharingEnabled ? "Sharing Family" : "Sharing Family"}
                    </Text>
                    {familySharingEnabled && <View style={styles.liveDotPurple} />}
                  </TouchableOpacity>
                </Animated.View>
              </View>

            </View>
        </View>
      )}

      {showFamilyLocations && visibleFamilyLocations.length > 0 && (
        <View style={familyListStyles.container}>
          <View style={familyListStyles.header}>
            <Heart size={14} color="#A855F7" />
            <Text style={familyListStyles.headerText}>Family Nearby</Text>
          </View>
          <FlatList
            ref={familyListRef}
            data={visibleFamilyLocations}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={familyListStyles.listContent}
            getItemLayout={(_data, index) => ({ length: 40, offset: 40 * index, index })}
            renderItem={({ item }) => {
              const initials = item.name
                .split(" ")
                .map((w: string) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <TouchableOpacity
                  style={[
                    familyListStyles.card,
                    focusFriendLocation?.userId === item.userId && familyListStyles.cardActive,
                  ]}
                  testID={`family-loc-${item.userId}`}
                  onPress={() => handleFocusFamily(item)}
                  activeOpacity={0.7}
                >
                  <View style={familyListStyles.avatarContainerSmall}>
                    {item.avatar ? (
                      <Image source={{ uri: item.avatar }} style={familyListStyles.avatarSmall} contentFit="cover" />
                    ) : (
                      <View style={familyListStyles.avatarFallbackSmall}>
                        <Text style={familyListStyles.avatarInitialsSmall}>{initials}</Text>
                      </View>
                    )}
                    <View style={familyListStyles.onlineBadgeSmall} />
                  </View>
                  <Text style={familyListStyles.nameSmall} numberOfLines={1}>{item.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {showFriendLocations && visibleFriendLocations.length > 0 && (
        <View style={friendListStyles.container}>
          <View style={friendListStyles.header}>
            <Users size={14} color="#3B82F6" />
            <Text style={friendListStyles.headerText}>Close Friends Nearby</Text>
          </View>
          <FlatList
            ref={friendListRef}
            data={visibleFriendLocations}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={friendListStyles.listContent}
            getItemLayout={(_data, index) => ({ length: 40, offset: 40 * index, index })}
            renderItem={({ item }) => {
              const initials = item.name
                .split(" ")
                .map((w: string) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <TouchableOpacity
                  style={[
                    friendListStyles.card,
                    focusFriendLocation?.userId === item.userId && friendListStyles.cardActive,
                  ]}
                  testID={`friend-loc-${item.userId}`}
                  onPress={() => handleFocusFriend(item)}
                  activeOpacity={0.7}
                >
                  <View style={friendListStyles.avatarContainerSmall}>
                    {item.avatar ? (
                      <Image source={{ uri: item.avatar }} style={friendListStyles.avatarSmall} contentFit="cover" />
                    ) : (
                      <View style={friendListStyles.avatarFallbackSmall}>
                        <Text style={friendListStyles.avatarInitialsSmall}>{initials}</Text>
                      </View>
                    )}
                    <View style={friendListStyles.onlineBadgeSmall} />
                  </View>
                  <Text style={friendListStyles.nameSmall} numberOfLines={1}>{item.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      <View style={styles.mapContainer}>
        {Platform.OS === "web" ? (
          <WebMapView restaurants={filteredRestaurants} userLocation={userLocation} onMarkerPress={handleMarkerPress} />
        ) : (
          <NativeMapView
            restaurants={filteredRestaurants}
            userLocation={userLocation}
            focusedRestaurant={focusedRestaurant}
            centerTrigger={centerTrigger}
            distanceMap={distanceMap}
            searchQuery={searchQuery}
            friendLocations={visibleFriendLocations}
            familyLocations={visibleFamilyLocations}
            focusFriendLocation={focusFriendLocation}
            focusFriendTrigger={focusFriendTrigger}
            focusedEvent={focusedEvent}
            eventFocusTrigger={eventFocusTrigger}
            events={events}
            onFriendMarkerPress={handleFocusFriend}
            onFamilyMarkerPress={handleFocusFamily}
            onMarkerPress={handleMarkerPress}
            onMapPress={handleMapPress}
            onLongPress={handleMapLongPress}
            onEventMarkerPress={handleEventMarkerPress}
          />
        )}

        {friends.length > 0 && (
          <View style={styles.mapOverlayButtons}>
            <TouchableOpacity
              style={[
                styles.mapOverlayBtn,
                showFriendLocations && styles.mapOverlayBtnActiveBlue,
              ]}
              onPress={handleToggleViewFriends}
              activeOpacity={0.7}
              testID="view-friends-location-button"
            >
              {showFriendLocations ? (
                <Eye size={14} color={Colors.white} />
              ) : (
                <EyeOff size={14} color={Colors.textSecondary} />
              )}
              <Text style={[
                styles.mapOverlayBtnText,
                showFriendLocations && styles.mapOverlayBtnTextActive,
              ]}>
                Friends{friendLocations.length > 0 ? ` (${friendLocations.length})` : ""}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mapOverlayBtn,
                showFamilyLocations && styles.mapOverlayBtnActivePurple,
              ]}
              onPress={handleToggleViewFamily}
              activeOpacity={0.7}
              testID="view-family-location-button"
            >
              {showFamilyLocations ? (
                <Eye size={14} color={Colors.white} />
              ) : (
                <EyeOff size={14} color={Colors.textSecondary} />
              )}
              <Text style={[
                styles.mapOverlayBtnText,
                showFamilyLocations && styles.mapOverlayBtnTextActive,
              ]}>
                Family{familyLocations.length > 0 ? ` (${familyLocations.length})` : ""}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {selectedPlace && (
        <Animated.View
          style={[
            selectedCardStyles.overlay,
            {
              opacity: selectedPlaceAnim,
              transform: [{
                translateY: selectedPlaceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [120, 0],
                }),
              }],
            },
          ]}
        >
          <View style={selectedCardStyles.card}>
            <TouchableOpacity
              style={selectedCardStyles.closeBtn}
              onPress={handleDismissSelected}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="dismiss-selected-place"
            >
              <X size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={selectedCardStyles.header}>
              <Image
                source={{ uri: selectedPlace.photos[0] }}
                style={selectedCardStyles.image}
                contentFit="cover"
              />
              <View style={selectedCardStyles.info}>
                <Text style={selectedCardStyles.name} numberOfLines={1}>{selectedPlace.name}</Text>
                <Text style={selectedCardStyles.cuisine}>{selectedPlace.cuisine ?? 'Place'}</Text>
                <View style={selectedCardStyles.meta}>
                  <Star size={12} color={Colors.star} fill={Colors.star} />
                  <Text style={selectedCardStyles.rating}>{selectedPlace.rating}</Text>
                  <Text style={selectedCardStyles.reviews}>({selectedPlace.reviewCount})</Text>
                  {distanceMap.get(selectedPlace.id) && (
                    <>
                      <View style={selectedCardStyles.dot} />
                      <Text style={selectedCardStyles.distance}>{distanceMap.get(selectedPlace.id)}</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
            <View style={selectedCardStyles.buttons}>
              <TouchableOpacity
                style={selectedCardStyles.detailsBtn}
                onPress={() => handleViewDetails(selectedPlace)}
                activeOpacity={0.8}
                testID="selected-view-details"
              >
                <Eye size={16} color="#fff" />
                <Text style={selectedCardStyles.btnText}>View Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={selectedCardStyles.navigateBtn}
                onPress={() => handleNavigateToPlace(selectedPlace)}
                activeOpacity={0.8}
                testID="selected-navigate"
              >
                <Navigation size={16} color="#fff" />
                <Text style={selectedCardStyles.btnText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      <View style={styles.bottomSheet}>
        <TouchableOpacity
          style={styles.toggleBar}
          onPress={toggleList}
          activeOpacity={0.7}
          testID="toggle-list"
        >
          <View style={styles.toggleHandle} />
          <View style={styles.toggleContent}>
            <Text style={styles.toggleText}>
              {filteredRestaurants.length} Place{filteredRestaurants.length !== 1 ? "s" : ""}
            </Text>
            {listExpanded ? (
              <ChevronDown size={18} color={Colors.textSecondary} />
            ) : (
              <ChevronUp size={18} color={Colors.textSecondary} />
            )}
          </View>
        </TouchableOpacity>

        {listExpanded && (
          <FlatList
            data={filteredRestaurants}
            renderItem={renderRestaurantItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}
      </View>

      <QuickEventModal
        visible={showQuickEvent}
        coordinate={quickEventCoord}
        friends={friends}
        onClose={handleQuickEventClose}
        onSubmit={handleQuickEventSubmit}
        isCreating={isCreating}
      />
    </View>
  );
}

const qeStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center" as const,
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    alignSelf: "center" as const,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    marginBottom: 20,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(230,57,70,0.15)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  timeGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
  },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeChipActive: {
    backgroundColor: "rgba(230,57,70,0.18)",
    borderColor: Colors.primary,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  timeChipTextActive: {
    color: Colors.primary,
  },
  datePreview: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  datePreviewText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "500" as const,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginLeft: 4,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#fff",
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: "italic" as const,
    paddingVertical: 8,
  },
  friendsScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  friendChip: {
    alignItems: "center" as const,
    width: 62,
    gap: 4,
  },
  friendChipActive: {},
  friendAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: Colors.border,
    overflow: "hidden" as const,
  },
  friendAvatarActive: {
    borderColor: Colors.primary,
    borderWidth: 2.5,
  },
  friendAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  friendInitials: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.textSecondary,
  },
  checkBadge: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  friendName: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: Colors.textSecondary,
    textAlign: "center" as const,
  },
  friendNameActive: {
    color: Colors.white,
    fontWeight: "600" as const,
  },
  createBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#fff",
    letterSpacing: 0.3,
  },
});

const brightMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#333333" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e0e0e0" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#f8d86e" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#666666" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#aadaff" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4a90d9" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#e8e8e8" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#c8e6c9" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4caf50" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#e0e0e0" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#c9c9c9" }],
  },
];

const markerStyles = StyleSheet.create({
  touchable: {
    alignItems: "center",
  },
  container: {
    alignItems: "center",
  },
  pin: {
    width: Platform.OS === 'android' ? 26 : 36,
    height: Platform.OS === 'android' ? 26 : 36,
    borderRadius: Platform.OS === 'android' ? 13 : 18,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: Platform.OS === 'android' ? 2 : 3,
    borderColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  pinFocused: {
    width: Platform.OS === 'android' ? 36 : 50,
    height: Platform.OS === 'android' ? 36 : 50,
    borderRadius: Platform.OS === 'android' ? 18 : 25,
    backgroundColor: '#F59E0B',
    borderColor: '#FDE68A',
    borderWidth: Platform.OS === 'android' ? 3 : 4,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
  },
  pinSearchResult: {
    width: Platform.OS === 'android' ? 30 : 40,
    height: Platform.OS === 'android' ? 30 : 40,
    borderRadius: Platform.OS === 'android' ? 15 : 20,
    backgroundColor: "#2563EB",
    borderColor: "#93C5FD",
    borderWidth: Platform.OS === 'android' ? 2 : 3,
    shadowColor: "#2563EB",
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: Platform.OS === 'android' ? 4 : 6,
    borderRightWidth: Platform.OS === 'android' ? 4 : 6,
    borderTopWidth: Platform.OS === 'android' ? 6 : 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Colors.white,
    marginTop: -1,
  },
  pinTailSearch: {
    borderTopColor: "#93C5FD",
  },
  labelContainer: {
    backgroundColor: "#E63946",
    paddingHorizontal: Platform.OS === 'android' ? 5 : 8,
    paddingVertical: Platform.OS === 'android' ? 2 : 3,
    borderRadius: Platform.OS === 'android' ? 4 : 6,
    marginTop: Platform.OS === 'android' ? 2 : 3,
    maxWidth: Platform.OS === 'android' ? 90 : 120,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  labelContainerFocused: {
    backgroundColor: '#92400E',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    maxWidth: Platform.OS === 'android' ? 110 : 160,
    paddingHorizontal: Platform.OS === 'android' ? 8 : 12,
    paddingVertical: Platform.OS === 'android' ? 3 : 5,
    borderRadius: Platform.OS === 'android' ? 6 : 10,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  labelContainerSearch: {
    backgroundColor: "#1E40AF",
    maxWidth: Platform.OS === 'android' ? 100 : 140,
    paddingHorizontal: Platform.OS === 'android' ? 6 : 10,
    paddingVertical: Platform.OS === 'android' ? 2 : 4,
    borderRadius: Platform.OS === 'android' ? 5 : 8,
    borderWidth: 1,
    borderColor: "#60A5FA",
  },
  labelText: {
    fontSize: Platform.OS === 'android' ? 8 : 10,
    fontWeight: "800" as const,
    color: "#FFFFFF",
    textAlign: "center" as const,
    letterSpacing: 0.3,
  },
  labelDistance: {
    fontSize: Platform.OS === 'android' ? 7 : 9,
    fontWeight: "700" as const,
    color: "#93C5FD",
    textAlign: "center" as const,
    marginTop: 1,
  },
  labelDistanceDefault: {
    color: "#FFB4B4",
  },
  calloutBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 10,
    minWidth: 190,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  calloutSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  calloutButtons: {
    flexDirection: "row" as const,
    gap: 6,
    marginTop: 8,
  },
  calloutBtnDetails: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 7,
    borderRadius: 8,
  },
  calloutBtnNavigate: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
    backgroundColor: "#2563EB",
    paddingVertical: 7,
    borderRadius: 8,
  },
  calloutBtnText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#fff",
  },
  calloutArrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Colors.surface,
    alignSelf: "center" as const,
  },
  calloutSimple: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  calloutSimpleName: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
    textAlign: "center" as const,
  },
  calloutTapHint: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: Colors.primary,
    textAlign: "center" as const,
    marginTop: 3,
  },
  calloutArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Colors.surface,
    alignSelf: "center" as const,
  },
});

const eventMarkerStyles = StyleSheet.create({
  wrapper: {
    alignItems: "center" as const,
    width: 150,
  },
  nameLabel: {
    backgroundColor: "#065F46",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 140,
    alignSelf: "center" as const,
    borderWidth: 1.5,
    borderColor: "#10B981",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 10,
  },
  nameLabelText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#fff",
    textAlign: "center" as const,
    letterSpacing: 0.3,
  },
  nameLabelArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#065F46",
    alignSelf: "center" as const,
    marginBottom: 2,
  },
  banner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: 130,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
    gap: 4,
  },
  bannerIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  bannerTitle: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "#fff",
    flexShrink: 1,
    letterSpacing: 0.2,
  },
  bannerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#10B981",
    alignSelf: "center" as const,
  },
  pinOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginTop: 2,
  },
  pinInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10B981",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 2.5,
    borderColor: "#fff",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 8,
  },
  pulseRing: {
    position: "absolute" as const,
    bottom: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignSelf: "center" as const,
  },

  calloutBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 10,
    minWidth: 180,
    maxWidth: 220,
    borderWidth: 1.5,
    borderColor: "#10B981",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  calloutHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  calloutIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  calloutInfo: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  calloutSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  calloutDate: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600" as const,
    marginTop: 6,
  },
  calloutHint: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: "#10B981",
    textAlign: "center" as const,
    marginTop: 4,
  },
  calloutArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Colors.surface,
    alignSelf: "center" as const,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 6,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  headerSubtitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 0,
  },
  locateButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locateButtonLoading: {
    borderColor: Colors.primary,
  },
  locateButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  locationBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(230,57,70,0.1)",
    gap: 6,
  },
  locationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  locationText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(230,57,70,0.15)",
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: "500" as const,
  },
  errorRetry: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: Colors.background,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchBarFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.white,
    fontWeight: "500" as const,
    paddingVertical: 0,
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  searchResultCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
    marginTop: 6,
    paddingLeft: 4,
  },
  mapContainer: {
    flex: 1,
    position: "relative" as const,
  },
  mapOverlayButtons: {
    position: "absolute" as const,
    top: 10,
    left: 10,
    flexDirection: "row" as const,
    gap: 8,
    zIndex: 10,
  },
  mapOverlayBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(30,30,30,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  mapOverlayBtnActiveBlue: {
    backgroundColor: "rgba(37,99,235,0.5)",
    borderColor: "rgba(59,130,246,0.6)",
  },
  mapOverlayBtnActivePurple: {
    backgroundColor: "rgba(147,51,234,0.5)",
    borderColor: "rgba(168,85,247,0.6)",
  },
  mapOverlayBtnText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  mapOverlayBtnTextActive: {
    color: Colors.white,
  },

  bottomSheet: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  toggleBar: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 4,
  },
  toggleHandle: {
    width: 28,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
    marginBottom: 4,
  },
  toggleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  list: {
    maxHeight: 180,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 8,
  },
  liveLocationSection: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  liveLocationRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 5,
    flexWrap: "wrap" as const,
  },
  viewMapButtonSeparator: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },
  shareButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 100,
    height: 32,
  },
  shareButtonActiveBlue: {
    backgroundColor: "#2563EB",
    borderColor: "#3B82F6",
  },
  shareButtonActivePurple: {
    backgroundColor: "#9333EA",
    borderColor: "#A855F7",
  },
  shareButtonText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  shareButtonTextActive: {
    color: Colors.white,
  },
  viewMapButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 100,
    height: 32,
  },
  viewMapButtonActiveBlue: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderColor: "#3B82F6",
  },
  viewMapButtonActivePurple: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    borderColor: "#A855F7",
  },
  viewMapButtonText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  viewMapButtonTextActive: {
    color: Colors.white,
  },
  pulseButtonWrapper: {
    position: "relative" as const,
    overflow: "visible" as const,
  },
  friendPulseRing: {
    position: "absolute" as const,
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#3B82F6",
    zIndex: -1,
  },
  familyPulseRing: {
    position: "absolute" as const,
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#A855F7",
    zIndex: -1,
  },
  friendPulseRingOuter: {
    position: "absolute" as const,
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#3B82F6",
    zIndex: -2,
  },
  familyPulseRingOuter: {
    position: "absolute" as const,
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#A855F7",
    zIndex: -2,
  },

  liveDotBlue: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#93C5FD",
    marginLeft: 2,
  },
  liveDotPurple: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#D8B4FE",
    marginLeft: 2,
  },

  noFriendsText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: "italic" as const,
  },
});

const friendMarkerStyles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  avatarRing: {
    width: Platform.OS === 'android' ? 22 : 28,
    height: Platform.OS === 'android' ? 22 : 28,
    borderRadius: Platform.OS === 'android' ? 11 : 14,
    borderWidth: Platform.OS === 'android' ? 1.5 : 2,
    borderColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  avatar: {
    width: Platform.OS === 'android' ? 16 : 22,
    height: Platform.OS === 'android' ? 16 : 22,
    borderRadius: Platform.OS === 'android' ? 8 : 11,
  },
  avatarFallback: {
    width: Platform.OS === 'android' ? 16 : 22,
    height: Platform.OS === 'android' ? 16 : 22,
    borderRadius: Platform.OS === 'android' ? 8 : 11,
    backgroundColor: "#1E40AF",
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    fontSize: Platform.OS === 'android' ? 7 : 9,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -2,
    width: Platform.OS === 'android' ? 6 : 8,
    height: Platform.OS === 'android' ? 6 : 8,
    borderRadius: Platform.OS === 'android' ? 3 : 4,
    backgroundColor: Colors.success,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  label: {
    backgroundColor: "#1E3A5F",
    paddingHorizontal: Platform.OS === 'android' ? 4 : 6,
    paddingVertical: Platform.OS === 'android' ? 1 : 2,
    borderRadius: Platform.OS === 'android' ? 4 : 5,
    maxWidth: Platform.OS === 'android' ? 65 : 80,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  labelArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#1E3A5F",
    alignSelf: "center" as const,
    marginBottom: 1,
  },
  labelName: {
    fontSize: Platform.OS === 'android' ? 7 : 8,
    fontWeight: "700" as const,
    color: Colors.white,
    textAlign: "center" as const,
  },
  labelTime: {
    fontSize: 8,
    fontWeight: "600" as const,
    color: "#93C5FD",
    textAlign: "center" as const,
    marginTop: 1,
  },
});

const familyMarkerStyles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  avatarRing: {
    width: Platform.OS === 'android' ? 22 : 28,
    height: Platform.OS === 'android' ? 22 : 28,
    borderRadius: Platform.OS === 'android' ? 11 : 14,
    borderWidth: Platform.OS === 'android' ? 1.5 : 2,
    borderColor: "#A855F7",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface,
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  avatar: {
    width: Platform.OS === 'android' ? 16 : 22,
    height: Platform.OS === 'android' ? 16 : 22,
    borderRadius: Platform.OS === 'android' ? 8 : 11,
  },
  avatarFallback: {
    width: Platform.OS === 'android' ? 16 : 22,
    height: Platform.OS === 'android' ? 16 : 22,
    borderRadius: Platform.OS === 'android' ? 8 : 11,
    backgroundColor: "#7E22CE",
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    fontSize: Platform.OS === 'android' ? 7 : 9,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -2,
    width: Platform.OS === 'android' ? 6 : 8,
    height: Platform.OS === 'android' ? 6 : 8,
    borderRadius: Platform.OS === 'android' ? 3 : 4,
    backgroundColor: Colors.success,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  label: {
    backgroundColor: "#3B1A5E",
    paddingHorizontal: Platform.OS === 'android' ? 4 : 6,
    paddingVertical: Platform.OS === 'android' ? 1 : 2,
    borderRadius: Platform.OS === 'android' ? 4 : 5,
    maxWidth: Platform.OS === 'android' ? 65 : 80,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#A855F7",
  },
  labelArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#3B1A5E",
    alignSelf: "center" as const,
    marginBottom: 1,
  },
  labelName: {
    fontSize: Platform.OS === 'android' ? 7 : 8,
    fontWeight: "700" as const,
    color: Colors.white,
    textAlign: "center" as const,
  },
});

const familyListStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 3,
  },
  headerText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#A855F7",
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 4,
    gap: 3,
  },
  card: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: "#3B1A5E",
    width: 36,
    gap: 2,
  },
  cardActive: {
    borderColor: "#A855F7",
    backgroundColor: "rgba(168,85,247,0.15)",
  },
  avatarContainerSmall: {
    position: "relative" as const,
  },
  avatarSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#A855F7",
  },
  avatarFallbackSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#7E22CE",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#A855F7",
  },
  avatarInitialsSmall: {
    fontSize: 8,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  onlineBadgeSmall: {
    position: "absolute" as const,
    bottom: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.success,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  nameSmall: {
    fontSize: 7,
    fontWeight: "700" as const,
    color: Colors.white,
    textAlign: "center" as const,
    width: 30,
  },
});

const friendListStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 3,
  },
  headerText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#3B82F6",
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 4,
    gap: 3,
  },
  card: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: "#1E3A5F",
    width: 36,
    gap: 2,
  },
  cardActive: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59,130,246,0.15)",
  },
  avatarContainerSmall: {
    position: "relative" as const,
  },
  avatarSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#3B82F6",
  },
  avatarFallbackSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1E40AF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#3B82F6",
  },
  avatarInitialsSmall: {
    fontSize: 8,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  onlineBadgeSmall: {
    position: "absolute" as const,
    bottom: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.success,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  nameSmall: {
    fontSize: 7,
    fontWeight: "700" as const,
    color: Colors.white,
    textAlign: "center" as const,
    width: 30,
  },
});

const webListStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
    backgroundColor: "rgba(13,13,13,0.85)",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    width: 240,
  },
  cardImage: {
    width: 70,
    height: 80,
  },
  cardInfo: {
    flex: 1,
    padding: 8,
    justifyContent: "center",
  },
  cardName: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  cardRating: {
    fontSize: 11,
    color: Colors.star,
    fontWeight: "600" as const,
  },
  cardCuisine: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  cardLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  cardLinkText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "600" as const,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  image: {
    width: 80,
    height: 80,
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
  },
  name: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  cuisine: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "500" as const,
    marginTop: 2,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  rating: {
    fontSize: 12,
    color: Colors.star,
    fontWeight: "600" as const,
  },
  reviews: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  price: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
  },
  distanceText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "700" as const,
  },
  arrow: {
    justifyContent: "center",
    paddingRight: 14,
  },
});

const selectedCardStyles = StyleSheet.create({
  overlay: {
    position: "absolute" as const,
    bottom: 70,
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  closeBtn: {
    position: "absolute" as const,
    top: 10,
    right: 10,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  header: {
    flexDirection: "row" as const,
    gap: 12,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  info: {
    flex: 1,
    justifyContent: "center" as const,
  },
  name: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
    paddingRight: 24,
  },
  cuisine: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "500" as const,
    marginTop: 2,
  },
  meta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    marginTop: 4,
  },
  rating: {
    fontSize: 12,
    color: Colors.star,
    fontWeight: "600" as const,
  },
  reviews: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  distance: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "700" as const,
  },
  buttons: {
    flexDirection: "row" as const,
    gap: 10,
    marginTop: 12,
  },
  detailsBtn: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  navigateBtn: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#fff",
  },
});

const suggestStyles = StyleSheet.create({
  wrapper: {
    zIndex: 999,
    position: "relative" as const,
  },
  container: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
    overflow: "hidden" as const,
  },
  item: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(230,57,70,0.15)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  iconWrapShop: {
    backgroundColor: "rgba(245,158,11,0.15)",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  metaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: 2,
  },
  cuisine: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  distance: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  moreRow: {
    paddingVertical: 10,
    alignItems: "center" as const,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  moreText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "500" as const,
  },
  emptyRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500" as const,
  },
});
