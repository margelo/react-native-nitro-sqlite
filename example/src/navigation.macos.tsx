import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  createNavigatorFactory,
  type DefaultNavigatorOptions,
  type NavigationListBase,
  type ParamListBase,
  type StackActionHelpers,
  type StackNavigationState,
  StackRouter,
  type StackRouterOptions,
  type TypedNavigator,
  useNavigationBuilder,
} from '@react-navigation/native'

type MacOSStackNavigationOptions = {
  title?: string
}

type EmptyEventMap = Record<string, never>

function MacOSStackNavigator(
  props: DefaultNavigatorOptions<
    ParamListBase,
    string | undefined,
    StackNavigationState<ParamListBase>,
    MacOSStackNavigationOptions,
    EmptyEventMap,
    unknown
  >,
) {
  const { state, descriptors, navigation, NavigationContent } =
    useNavigationBuilder<
      StackNavigationState<ParamListBase>,
      StackRouterOptions,
      StackActionHelpers<ParamListBase>,
      MacOSStackNavigationOptions,
      EmptyEventMap
    >(StackRouter, props)
  const route = state.routes[state.index]
  if (route == null) {
    return null
  }

  const descriptor = descriptors[route.key]
  if (descriptor == null) {
    return null
  }

  const title =
    typeof descriptor.options.title === 'string' &&
    descriptor.options.title.length > 0
      ? descriptor.options.title
      : route.name

  return (
    <NavigationContent>
      <View style={styles.container}>
        <View style={styles.titleBar}>
          {navigation.canGoBack() ? (
            <Pressable
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>‹ Back</Text>
            </Pressable>
          ) : (
            <View style={styles.titleBarSide} />
          )}
          <Text
            numberOfLines={1}
            style={styles.title}
          >
            {title}
          </Text>
          <View style={styles.titleBarSide} />
        </View>
        <View style={styles.screen}>{descriptor.render()}</View>
      </View>
    </NavigationContent>
  )
}

function createMacOSStackNavigator<
  ParamList extends ParamListBase,
>(): TypedNavigator<{
  ParamList: ParamList
  NavigatorID: string | undefined
  State: StackNavigationState<ParamList>
  ScreenOptions: MacOSStackNavigationOptions
  EventMap: EmptyEventMap
  NavigationList: NavigationListBase<ParamList>
  Navigator: typeof MacOSStackNavigator
}> {
  return createNavigatorFactory(MacOSStackNavigator)()
}

export const RootStack = createMacOSStackNavigator()

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleBar: {
    alignItems: 'center',
    borderBottomColor: '#d1d1d1',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  titleBarSide: {
    width: 72,
  },
  backButton: {
    width: 72,
  },
  backButtonText: {
    color: '#007aff',
    fontSize: 16,
  },
  title: {
    color: '#111',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  screen: {
    flex: 1,
  },
})
